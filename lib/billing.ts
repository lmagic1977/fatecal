import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import type { Interval, Plan } from './plans';

// One small private record per account: which plan, and the Stripe ids behind it.
export interface Sub {
  plan: Plan; status: string; interval?: Interval; customerId?: string; subId?: string;
  periodEnd?: string; trialEnd?: string; cancelAtPeriodEnd?: boolean; trialUsed?: boolean; updatedAt: string;
}
const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const subPath = (uid: string) => `subs/${h(uid)}.json`;
const custPath = (customerId: string) => `subs-by-customer/${h(customerId)}.json`;

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const r = await get(path, { access: 'private', useCache: false });
    if (r && 'stream' in r && r.stream) return JSON.parse(await new Response(r.stream).text());
  } catch { /* none */ }
  return null;
}
const writeJson = (path: string, v: unknown) => put(path, JSON.stringify(v), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });

export async function readSub(uid: string): Promise<Sub> {
  return (await readJson<Sub>(subPath(uid))) ?? { plan: 'free', status: 'none', updatedAt: new Date(0).toISOString() };
}
export async function writeSub(uid: string, s: Sub) {
  await writeJson(subPath(uid), s);
  if (s.customerId) await writeJson(custPath(s.customerId), { uid });
}
export async function uidForCustomer(customerId: string): Promise<string | null> {
  return (await readJson<{ uid: string }>(custPath(customerId)))?.uid ?? null;
}
// paid features apply while trialing or active (and through past_due grace)
export const effectivePlan = (s: Sub): Plan => (['active', 'trialing', 'past_due'].includes(s.status) ? s.plan : 'free');

// Daily counters per account, e.g. FateBot questions.
const usePath = (uid: string, what: string, day: string) => `usage/${h(uid)}/${what}-${day}.json`;
export async function bumpUsage(uid: string, what: string, period: 'day' | 'month' = 'day'): Promise<number> {
  const d = new Date().toISOString();
  const key = period === 'day' ? d.slice(0, 10) : d.slice(0, 7);
  const cur = (await readJson<{ n: number }>(usePath(uid, what, key)))?.n ?? 0;
  await writeJson(usePath(uid, what, key), { n: cur + 1 }).catch(() => {});
  return cur + 1;
}
export async function readUsageCount(uid: string, what: string, period: 'day' | 'month' = 'day'): Promise<number> {
  const d = new Date().toISOString();
  return (await readJson<{ n: number }>(usePath(uid, what, period === 'day' ? d.slice(0, 10) : d.slice(0, 7))))?.n ?? 0;
}

// The plan to enforce for an account. Before Stripe is set up nobody is locked out (everyone gets Basic);
// emails listed in FATECAL_ADMINS always get Premium.
export async function planFor(u: { uid: string; email?: string }): Promise<Plan> {
  const admins = (process.env.FATECAL_ADMINS ?? '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  if (u.email && admins.includes(u.email.toLowerCase())) return 'premium';
  if (!process.env.STRIPE_SECRET_KEY) return 'basic';
  return effectivePlan(await readSub(u.uid));
}
