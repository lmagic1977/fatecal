import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { h, readJson, removeJson, writeJson } from './store';

// WhatsApp Business Cloud API. Env:
//   WHATSAPP_TOKEN        permanent access token (system user)
//   WHATSAPP_PHONE_ID     the business phone number id
//   WHATSAPP_NUMBER       the number people message, digits only, e.g. 17145551234 (for wa.me links)
//   WHATSAPP_VERIFY_TOKEN any string; also typed into Meta's webhook settings
//   WHATSAPP_APP_SECRET   the Meta app secret, to check webhook signatures
export const waEnabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_NUMBER);
const VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0';

export async function sendText(to: string, body: string) {
  const r = await fetch(`https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: body.slice(0, 4000), preview_url: false } }),
  }).catch(() => null);
  return !!r?.ok;
}

export function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // not configured yet: accept (verify token still protects setup)
  if (!header?.startsWith('sha256=')) return false;
  const a = Buffer.from(header.slice(7), 'hex'), b = createHmac('sha256', secret).update(raw).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- linking a WhatsApp number to a FateCal account ----
const codePath = (code: string) => `walink/${code}.json`;
const phonePath = (phone: string) => `wa/${h(phone)}.json`;
const userPath = (uid: string) => `wa-user/${h(uid)}.json`;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export async function newLinkCode(uid: string) {
  const code = Array.from({ length: 6 }, () => ALPHA[randomInt(0, ALPHA.length)]).join('');
  await writeJson(codePath(code), { uid, exp: Date.now() + 30 * 60_000 });
  return code;
}
export async function useLinkCode(code: string, phone: string): Promise<string | null> {
  const rec = await readJson<{ uid: string; exp: number }>(codePath(code));
  if (!rec || rec.exp < Date.now()) return null;
  await removeJson(codePath(code));
  const old = await readJson<{ phone: string }>(userPath(rec.uid));
  if (old?.phone && old.phone !== phone) await removeJson(phonePath(old.phone));
  await writeJson(phonePath(phone), { uid: rec.uid, at: new Date().toISOString() });
  await writeJson(userPath(rec.uid), { phone, at: new Date().toISOString() });
  return rec.uid;
}
export const uidForPhone = async (phone: string) => (await readJson<{ uid: string }>(phonePath(phone)))?.uid ?? null;
export const phoneForUid = async (uid: string) => (await readJson<{ phone: string }>(userPath(uid)))?.phone ?? null;
export async function unlink(uid: string) {
  const p = await phoneForUid(uid);
  if (p) await removeJson(phonePath(p));
  await removeJson(userPath(uid));
}
// a message id we have already handled (Meta may deliver a webhook more than once)
export async function seen(id: string) {
  if (await readJson(`wamsg/${h(id)}.json`)) return true;
  await writeJson(`wamsg/${h(id)}.json`, { at: Date.now() });
  return false;
}
export const maskPhone = (p: string) => `+${p.slice(0, Math.max(1, p.length - 8))}****${p.slice(-4)}`;
