import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { DEFAULT_PREFS, pushEnabled, readPush, sendAll, writePush, type PushPrefs } from '@/lib/push';
import { validTz } from '@/lib/parse';

export const runtime = 'nodejs';

// GET → the public key and this person's reminder settings
export async function GET() {
  const u = await currentUser();
  const rec = u ? await readPush(u.uid) : null;
  return NextResponse.json({ enabled: pushEnabled(), key: process.env.VAPID_PUBLIC_KEY ?? null, prefs: rec?.prefs ?? DEFAULT_PREFS, devices: rec?.subs.length ?? 0 });
}

// POST {subscription?, prefs?, tz, lang, test?} → save this device and/or settings
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  if (!pushEnabled()) return NextResponse.json({ error: 'not_enabled' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const rec = (await readPush(u.uid)) ?? { uid: u.uid, subs: [], prefs: DEFAULT_PREFS, lang: 'en', tz: 'America/Los_Angeles' };
  const sub = b.subscription;
  if (sub?.endpoint && sub?.keys?.p256dh && sub?.keys?.auth) {
    rec.subs = [...rec.subs.filter((s) => s.endpoint !== sub.endpoint), { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } }].slice(-6);
  }
  if (b.prefs) {
    const p = b.prefs as Partial<PushPrefs>;
    rec.prefs = {
      before: [0, 10, 15, 30, 60, 120].includes(Number(p.before)) ? Number(p.before) : rec.prefs.before,
      morning: typeof p.morning === 'boolean' ? p.morning : rec.prefs.morning,
      morningHour: Number.isInteger(p.morningHour) && p.morningHour! >= 5 && p.morningHour! <= 11 ? p.morningHour! : rec.prefs.morningHour,
    };
  }
  if (validTz(b.tz)) rec.tz = b.tz;
  if (['en', 'zh', 'es', 'pt'].includes(b.lang)) rec.lang = b.lang;
  let tested = 0;
  if (b.test) {
    const msg = { en: ['FateCal reminders are on ✓', "We'll remind you before your events and send a short morning reading."], zh: ['随身吉历提醒已开启 ✓', '日程开始前会提醒你，每天早上也会发一条简短的运势。'], es: ['Recordatorios de FateCal activados ✓', 'Te avisaremos antes de tus eventos y te enviaremos una lectura breve por la mañana.'], pt: ['Lembretes do FateCal ativados ✓', 'Vamos te avisar antes dos seus eventos e mandar uma leitura curta toda manhã.'] }[rec.lang as 'en' | 'zh' | 'es' | 'pt'] ?? ['FateCal', ''];
    tested = await sendAll(rec, { title: msg[0], body: msg[1], tag: 'test' });
  }
  await writePush(rec);
  return NextResponse.json({ ok: true, devices: rec.subs.length, prefs: rec.prefs, tested });
}

// DELETE {endpoint} → stop reminders on this device
export async function DELETE(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const rec = await readPush(u.uid);
  if (rec) { rec.subs = rec.subs.filter((s) => s.endpoint !== b.endpoint); await writePush(rec); }
  return NextResponse.json({ ok: true });
}
