import { createHmac } from 'node:crypto';
import { h, readJson, removeJson, writeJson } from './store';
import { addGrantDays } from './billing';
import { dayKey } from './accounts';

// Invite friends: each friend who signs up through your link and finishes their birth details
// gives both of you 1 month of Basic (stacks; up to MAX_MONTHS for the inviter).
export const REF_DAYS = 30;
export const MAX_MONTHS = 24;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// A stable 7-character code per account (no list of codes needed to make one).
export function codeFor(uid: string) {
  const d = createHmac('sha256', process.env.AUTH_SECRET || 'fatecal').update(`ref:${uid}`).digest();
  return Array.from({ length: 7 }, (_, i) => ALPHA[d[i] % ALPHA.length]).join('');
}
export async function ensureCode(uid: string) {
  const code = codeFor(uid);
  if (!(await readJson(`ref/${code}.json`))) await writeJson(`ref/${code}.json`, { uid });
  return code;
}
export const uidForCode = async (code: string) => (await readJson<{ uid: string }>(`ref/${code.toUpperCase()}.json`))?.uid ?? null;

export interface RefStats { count: number; months: number; capped?: boolean }
export const readStats = async (uid: string): Promise<RefStats> => (await readJson<RefStats>(`refstats/${h(uid)}.json`)) ?? { count: 0, months: 0 };

// Right after sign-in: remember who invited this new account (credited later, when the profile is saved).
export async function claim(uid: string, code: string): Promise<'ok' | 'self' | 'invalid' | 'old' | 'already'> {
  const inviter = await uidForCode(code);
  if (!inviter) return 'invalid';
  if (inviter === uid) return 'self';
  if (await readJson(`referred/${h(uid)}.json`)) return 'already';
  // only new accounts (signed up within the last 2 days) and ones without a saved chart yet
  const acc = await readJson<{ createdAt: string; legacy?: boolean }>(`accounts/${h(uid)}.json`);
  if (!acc || acc.legacy || Date.now() - new Date(acc.createdAt).getTime() > 2 * 86400000) return 'old';
  if (await readJson(`users/${h(uid)}.json`)) return 'old';
  await writeJson(`refpending/${h(uid)}.json`, { inviter, code, at: new Date().toISOString() });
  return 'ok';
}

// Called when an account saves its profile: if it was invited, reward both sides once.
export async function settle(uid: string) {
  const p = await readJson<{ inviter: string; code: string }>(`refpending/${h(uid)}.json`);
  if (!p) return;
  await removeJson(`refpending/${h(uid)}.json`);
  if (await readJson(`referred/${h(uid)}.json`)) return;
  await writeJson(`referred/${h(uid)}.json`, { inviter: p.inviter, at: new Date().toISOString() });
  await addGrantDays(uid, REF_DAYS, `REF:${p.code}`);
  const st = await readStats(p.inviter);
  st.count += 1;
  if (st.months < MAX_MONTHS) { st.months += 1; await addGrantDays(p.inviter, REF_DAYS, `REF:${p.code}`); } else st.capped = true;
  await writeJson(`refstats/${h(p.inviter)}.json`, st);
  await writeJson(`refdone/${dayKey()}/${h(uid)}.json`, { at: new Date().toISOString() });
}
