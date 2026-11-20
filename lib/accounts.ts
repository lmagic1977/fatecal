import { createHash } from 'node:crypto';
import { get, list, put } from '@vercel/blob';
import { PROMOS } from './plans';

// A tiny sign-up log for the operator: one record per account, plus one per day of first sign-in.
// Stored privately in Blob; nothing here is shown to other users.
const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const TZ = 'America/Los_Angeles';
export const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export interface AccountRec { createdAt: string; provider: string; email?: string; name?: string; lastSeen: string }

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const r = await get(path, { access: 'private', useCache: false });
    if (r && 'stream' in r && r.stream) return JSON.parse(await new Response(r.stream).text());
  } catch { /* none */ }
  return null;
}
const writeJson = (path: string, v: unknown) => put(path, JSON.stringify(v), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });

// Called on every sign-in. Creates the record the first time; otherwise updates lastSeen at most once a day.
export async function recordSignIn(uid: string, provider: string, email?: string | null, name?: string | null) {
  const path = `accounts/${h(uid)}.json`;
  const now = new Date().toISOString();
  const old = await readJson<AccountRec>(path);
  if (!old) {
    const rec: AccountRec = { createdAt: now, provider, email: email ?? undefined, name: name ?? undefined, lastSeen: now };
    await writeJson(path, rec);
    await writeJson(`signups/${dayKey()}/${h(uid)}.json`, rec);
  } else if (dayKey(new Date(old.lastSeen)) !== dayKey()) {
    await writeJson(path, { ...old, lastSeen: now });
  }
}

// Called when a signed-in person opens the app. People who signed up before this log existed get a record
// marked legacy (no sign-up day), and everyone's lastSeen moves to today.
export async function touch(uid: string, email?: string | null, name?: string | null) {
  const path = `accounts/${h(uid)}.json`;
  const old = await readJson<AccountRec & { legacy?: boolean }>(path);
  const now = new Date().toISOString();
  if (!old) {
    const hadProfile = !!(await readJson(`users/${h(uid)}.json`));
    if (hadProfile) { await writeJson(path, { createdAt: now, provider: uid.split(':')[0], email: email ?? undefined, name: name ?? undefined, lastSeen: now, legacy: true }); return; }
    return recordSignIn(uid, uid.split(':')[0], email, name);
  }
  if (dayKey(new Date(old.lastSeen)) !== dayKey() || (!old.email && email)) await writeJson(path, { ...old, email: old.email ?? email ?? undefined, lastSeen: now });
}

async function listAll(prefix: string) {
  const out: { pathname: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs.map((b) => ({ pathname: b.pathname, uploadedAt: b.uploadedAt })));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

export interface Stats {
  today: string; accounts: number; profiles: number;
  byDay: { day: string; n: number }[];          // last 14 days, newest first
  recent: AccountRec[];                          // sign-ups today and yesterday
  activeToday: number;
  subs: Record<string, number>;                  // e.g. { 'basic/active': 2, 'basic/trialing': 1 }
  gifts: Record<string, { used: number; max: number }>;
}

export async function stats(): Promise<Stats> {
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => dayKey(new Date(Date.now() - i * 86400000)));
  const [accounts, profiles, subs, signups] = await Promise.all([
    listAll('accounts/'), listAll('users/'), listAll('subs/'), listAll('signups/'),
  ]);
  const byDay = days.map((day) => ({ day, n: signups.filter((s) => s.pathname.startsWith(`signups/${day}/`)).length }));
  const recentPaths = signups.filter((s) => s.pathname.startsWith(`signups/${days[0]}/`) || s.pathname.startsWith(`signups/${days[1]}/`));
  const recent = (await Promise.all(recentPaths.map((s) => readJson<AccountRec>(s.pathname)))).filter(Boolean) as AccountRec[];
  recent.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeToday = accounts.filter((a) => dayKey(a.uploadedAt) === today).length;
  // people with a saved profile but no account record yet (signed up before the log) still count
  const known = new Set(accounts.map((a) => a.pathname.split('/')[1]));
  const extra = profiles.filter((p) => !known.has(p.pathname.split('/')[1])).length;
  const subRecs = await Promise.all(subs.map((s) => readJson<{ plan: string; status: string }>(s.pathname)));
  const subCount: Record<string, number> = {};
  for (const s of subRecs) if (s && s.status !== 'none') subCount[`${s.plan}/${s.status}`] = (subCount[`${s.plan}/${s.status}`] ?? 0) + 1;
  const gifts: Stats['gifts'] = {};
  for (const [code, p] of Object.entries(PROMOS)) gifts[code] = { used: (await readJson<{ n: number }>(`promos/${code}.json`))?.n ?? 0, max: p.max };
  return { today, accounts: accounts.length + extra, profiles: profiles.length, byDay, recent, activeToday, subs: subCount, gifts };
}

export const adminEmails = () => (process.env.FATECAL_ADMINS ?? '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
