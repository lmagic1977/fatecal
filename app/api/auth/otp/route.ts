import { NextResponse } from 'next/server';
import { emailEnabled, phoneEnabled, normEmail, normPhone, sendEmailCode, sendPhoneCode } from '@/lib/otp';

export const runtime = 'nodejs';

// Sends a sign-in code by email or SMS. Checking the code happens in the "otp" sign-in provider (auth.ts).
const hits = new Map<string, number[]>();
function limited(key: string, max: number, ms: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < ms);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const lang = body?.lang === 'zh' ? 'zh' : 'en';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (limited(`ip:${ip}`, 8, 10 * 60_000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  if (body?.channel === 'email') {
    if (!emailEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 503 });
    const to = normEmail(String(body.to ?? ''));
    if (!to) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    if (limited(`to:${to}`, 5, 60 * 60_000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    const r = await sendEmailCode(to, lang);
    return NextResponse.json({ result: r }, { status: r === 'sent' ? 200 : r === 'wait' ? 429 : 502 });
  }
  if (body?.channel === 'phone') {
    if (!phoneEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 503 });
    const to = normPhone(String(body.to ?? ''));
    if (!to) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    if (limited(`to:${to}`, 5, 60 * 60_000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    const r = await sendPhoneCode(to, lang);
    return NextResponse.json({ result: r }, { status: r === 'sent' ? 200 : r === 'wait' ? 429 : 502 });
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}
