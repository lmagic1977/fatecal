import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { get, put, del } from '@vercel/blob';

// One-time sign-in codes.
// Email: we make a 6-digit code, keep only its HMAC (10 minutes, 5 tries) in private Blob storage, and send it with Postmark.
// Phone: Twilio Verify makes, sends and checks the code itself.
// Env: POSTMARK_SERVER_TOKEN, MAIL_FROM (optional); TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID

export const emailEnabled = () => !!process.env.POSTMARK_SERVER_TOKEN;
export const phoneEnabled = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SID);

export const normEmail = (v: string) => {
  const e = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : null;
};
export const normPhone = (v: string) => {
  const p = '+' + v.replace(/[^\d]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
};

const secret = () => process.env.AUTH_SECRET || 'dev-secret';
const mac = (id: string, code: string) => createHmac('sha256', secret()).update(`${id}|${code}`).digest('hex');
const pathFor = (id: string) => `otp/${createHash('sha256').update(id).digest('hex').slice(0, 32)}.json`;

interface Rec { h: string; exp: number; tries: number; sent: number }
async function read(id: string): Promise<Rec | null> {
  try {
    const r = await get(pathFor(id), { access: 'private', useCache: false });
    if (r && 'stream' in r && r.stream) return JSON.parse(await new Response(r.stream).text());
  } catch { /* none */ }
  return null;
}
const write = (id: string, rec: Rec) => put(pathFor(id), JSON.stringify(rec), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });

export type SendResult = 'sent' | 'wait' | 'failed';

export async function sendEmailCode(email: string, lang: 'en' | 'zh' | 'es'): Promise<SendResult> {
  const id = `email:${email}`;
  const old = await read(id);
  if (old && Date.now() - old.sent < 45_000) return 'wait';
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  try { await write(id, { h: mac(id, code), exp: Date.now() + 10 * 60_000, tries: 0, sent: Date.now() }); } catch { return 'failed'; }
  const zh = lang === 'zh', es = lang === 'es';
  const subject = zh ? `你的随身命历（FateCal）登录码：${code}` : es ? `Tu código de acceso a FateCal: ${code}` : `Your FateCal sign-in code: ${code}`;
  const text = es
    ? `Tu código de acceso a FateCal es ${code}\n\nCaduca en 10 minutos. Si no lo pediste, puedes ignorar este correo.\n\nFateCal · fatecal.com`
    : zh
    ? `你的随身命历（FateCal）登录码是 ${code}\n\n10 分钟内有效。如果不是你本人操作，忽略这封邮件即可。\n\n随身命历 FateCal · fatecal.com`
    : `Your FateCal sign-in code is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.\n\nFateCal · fatecal.com`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1f1b16">
<div style="font-weight:700;font-size:20px;margin-bottom:16px">FateCal</div>
<p>${zh ? '你的登录码：' : es ? 'Tu código de acceso:' : 'Your sign-in code:'}</p>
<div style="font-size:32px;letter-spacing:6px;font-weight:700;margin:12px 0">${code}</div>
<p style="color:#6b6257;font-size:14px">${zh ? '10 分钟内有效。如果不是你本人操作，忽略这封邮件即可。' : es ? 'Caduca en 10 minutos. Si no lo pediste, puedes ignorar este correo.' : "It expires in 10 minutes. If you didn't ask for it, you can ignore this email."}</p></div>`;
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN! },
    body: JSON.stringify({ From: process.env.MAIL_FROM || 'FateCal <hello@fatecal.com>', To: email, Subject: subject, TextBody: text, HtmlBody: html, MessageStream: 'outbound', Tag: 'signin' }),
  }).catch(() => null);
  return res && res.ok ? 'sent' : 'failed';
}

export async function checkEmailCode(email: string, code: string): Promise<boolean> {
  const id = `email:${email}`;
  const rec = await read(id);
  if (!rec || Date.now() > rec.exp || rec.tries >= 5) return false;
  const a = Buffer.from(rec.h, 'hex'), b = Buffer.from(mac(id, code.trim()), 'hex');
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) await del(pathFor(id)).catch(() => {});
  else await write(id, { ...rec, tries: rec.tries + 1 }).catch(() => {});
  return ok;
}

const twilio = (path: string, form: Record<string, string>) =>
  fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SID}/${path}`, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  }).catch(() => null);

export async function sendPhoneCode(phone: string, lang: 'en' | 'zh' | 'es'): Promise<SendResult> {
  const res = await twilio('Verifications', { To: phone, Channel: 'sms', Locale: lang });
  if (res?.status === 429) return 'wait';
  return res && res.ok ? 'sent' : 'failed';
}

export async function checkPhoneCode(phone: string, code: string): Promise<boolean> {
  const res = await twilio('VerificationCheck', { To: phone, Code: code.trim() });
  if (!res || !res.ok) return false;
  const j = await res.json().catch(() => null);
  return j?.status === 'approved';
}
