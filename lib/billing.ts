import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { PROMOS, type Interval, type Plan } from './plans';

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
  if (u.email && process.env.TEST_LOGIN_EMAIL && u.email.toLowerCase() === process.env.TEST_LOGIN_EMAIL.trim().toLowerCase()) return 'basic';
  if (!process.env.STRIPE_SECRET_KEY) return 'basic';
  const paid = effectivePlan(await readSub(u.uid));
  const g = await activeGrant(u.uid);
  const rank: Record<Plan, number> = { free: 0, basic: 1, premium: 2 };
  return g && rank[g.plan] > rank[paid] ? g.plan : paid;
}

// ---- free-access codes (no card, no Stripe): a separate record so Stripe updates never overwrite it ----
export interface Grant { plan: Exclude<Plan, 'free'>; until: string; code: string; at: string; promo?: string; refMonths?: number }
const grantPath = (uid: string) => `grants/${h(uid)}.json`;
const promoPath = (code: string) => `promos/${code}.json`;
export const readGrant = (uid: string) => readJson<Grant>(grantPath(uid));
export async function activeGrant(uid: string): Promise<Grant | null> {
  const g = await readGrant(uid);
  return g && new Date(g.until) > new Date() ? g : null;
}
export async function promoLeft(code: string): Promise<number> {
  const p = PROMOS[code]; if (!p) return 0;
  return Math.max(0, p.max - ((await readJson<{ n: number }>(promoPath(code)))?.n ?? 0));
}
export type RedeemResult = { ok: true; grant: Grant } | { ok: false; error: 'invalid' | 'used' | 'full' };
export async function redeem(uid: string, raw: string): Promise<RedeemResult> {
  const code = raw.trim().toUpperCase();
  const p = PROMOS[code];
  if (!p) return { ok: false, error: 'invalid' };
  const old = await readGrant(uid);
  if (old && (old.promo || PROMOS[old.code])) return { ok: false, error: 'used' };
  const n = (await readJson<{ n: number }>(promoPath(code)))?.n ?? 0;
  if (n >= p.max) return { ok: false, error: 'full' };
  await writeJson(promoPath(code), { n: n + 1 });
  const start = old && new Date(old.until) > new Date() ? new Date(old.until).getTime() : Date.now();
  const grant: Grant = { ...(old ?? {}), plan: p.plan, code, promo: code, at: new Date().toISOString(), until: new Date(start + p.days * 86400000).toISOString() };
  await writeJson(grantPath(uid), grant);
  return { ok: true, grant };
}

// Add free Basic time (referrals). Stacks on top of any time already given.
export async function addGrantDays(uid: string, days: number, code: string) {
  const old = await readGrant(uid);
  const start = old && new Date(old.until) > new Date() ? new Date(old.until).getTime() : Date.now();
  const g: Grant = { ...(old ?? { code }), plan: old?.plan ?? 'basic', at: new Date().toISOString(), until: new Date(start + days * 86400000).toISOString(), refMonths: (old?.refMonths ?? 0) + Math.round(days / 30) };
  await writeJson(grantPath(uid), g);
  return g;
}
