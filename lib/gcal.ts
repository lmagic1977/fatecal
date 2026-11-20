import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import { SITE_URL } from './site';

// Read-only Google Calendar connection without a FateCal account.
// The browser keeps a random key; the server keeps the Google refresh token, encrypted, under a hash of that key.
// Uses the same Google OAuth client as sign-in (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET).
export const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const REDIRECT = `${SITE_URL}/api/gcal/callback`;
export const gcalEnabled = () => !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);
export const validKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9-]{20,64}$/.test(k);

const secret = () => process.env.AUTH_SECRET || '';
const pathFor = (key: string) => `gcal/${createHash('sha256').update(`gcal|${key}`).digest('hex').slice(0, 40)}.json`;
const aesKey = () => createHash('sha256').update(`gcal-token|${secret()}`).digest();

// state = key.timestamp.signature, so the callback knows which browser asked and that we made the link
export function makeState(key: string) {
  const body = `${key}.${Date.now()}`;
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
export function readState(state: string): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [key, ts, sig] = parts;
  const want = createHmac('sha256', secret()).update(`${key}.${ts}`).digest('base64url');
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  if (Date.now() - Number(ts) > 15 * 60_000 || !validKey(key)) return null;
  return key;
}

function seal(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function open(b64: string) {
  const buf = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', aesKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

export interface Stored { refresh: string; email?: string }
export async function saveToken(key: string, s: Stored) {
  await put(pathFor(key), JSON.stringify({ v: seal(JSON.stringify(s)) }), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
}
export async function loadToken(key: string): Promise<Stored | null> {
  try {
    const r = await get(pathFor(key), { access: 'private', useCache: false });
    if (r && 'stream' in r && r.stream) return JSON.parse(open(JSON.parse(await new Response(r.stream).text()).v));
  } catch { /* none or unreadable */ }
  return null;
}
export async function dropToken(key: string) {
  const s = await loadToken(key);
  if (s?.refresh) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.refresh)}`, { method: 'POST' }).catch(() => {});
  await del(pathFor(key)).catch(() => {});
}

export async function exchangeCode(code: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.AUTH_GOOGLE_ID!, client_secret: process.env.AUTH_GOOGLE_SECRET!, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  });
  return res.ok ? res.json() : null;
}
export async function accessToken(refresh: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refresh, client_id: process.env.AUTH_GOOGLE_ID!, client_secret: process.env.AUTH_GOOGLE_SECRET!, grant_type: 'refresh_token' }),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()).access_token ?? null;
}
