import { NextResponse } from 'next/server';
import { computeChart, readEvent, type CalEvent } from '@/lib/engine';
import { parseSentence, utcToZoned, validTz, zonedToUtc } from '@/lib/parse';
import { addPending, readUserData } from '@/lib/pending';
import { bumpUsage, planFor, readUsageCount } from '@/lib/billing';
import { LIMITS } from '@/lib/plans';
import { seen, sendText, uidForPhone, unlink, useLinkCode, validSignature } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const maxDuration = 30;

type L = 'en' | 'zh' | 'es';
const M = {
  en: {
    hello: 'Hi! I\'m FateCal. To start, link this WhatsApp to your account: open fatecal.com → Settings → WhatsApp, and send me the code you see there.',
    linked: '✅ Linked! Now just tell me your plans, e.g. "doctor tomorrow 3pm" or "gym every Tue and Thu 7pm". I\'ll add them to FateCal and tell you how the timing looks.',
    badCode: 'That code didn\'t work or has expired. Get a new one in fatecal.com → Settings → WhatsApp.',
    unlinked: 'Unlinked. Your FateCal account is no longer connected to this WhatsApp.',
    noProfile: 'Please finish your birth details at fatecal.com first, then message me again.',
    none: 'I couldn\'t find a date or event in that. Try "dinner with Amy Friday 7pm".',
    voice: 'I can only read text for now. Tip: tap the 🎤 on your keyboard to dictate.',
    limit: (n: number) => `You've used today's ${n} quick adds. Upgrade at fatecal.com for more.`,
    added: (n: number) => (n === 1 ? '✅ Added to FateCal:' : `✅ Added ${n} to FateCal:`),
    better: (t: string, s: number) => `   ↳ Better: ${t} (${s}). Tap it in the app to move.`,
    v: { good: 'good', neutral: 'okay', bad: 'not ideal' }, allDay: 'all day', every: '🔁 repeats',
    foot: 'Open: https://fatecal.com',
  },
  zh: {
    hello: '你好！我是 FateCal。先把这个 WhatsApp 和你的账号绑定：打开 fatecal.com →「设置」→「WhatsApp」，把看到的绑定码发给我。',
    linked: '✅ 绑定成功！以后直接告诉我你的安排就行，比如“明天下午3点看医生”“每周二、四晚上7点健身”。我会记到 FateCal，并告诉你时间顺不顺。',
    badCode: '这个绑定码无效或已过期。请到 fatecal.com →「设置」→「WhatsApp」重新获取。',
    unlinked: '已解绑，这个 WhatsApp 不再连接你的 FateCal 账号。',
    noProfile: '请先在 fatecal.com 填好生日资料，再来找我。',
    none: '没听出日期或事情。试试“周五晚上7点和小王吃饭”。',
    voice: '暂时只能读文字。小技巧：点键盘上的 🎤 用语音输入，会自动变成文字。',
    limit: (n: number) => `今天的 ${n} 次一句话添加已用完。到 fatecal.com 升级可以用更多。`,
    added: (n: number) => (n === 1 ? '✅ 已记到 FateCal：' : `✅ 已记到 FateCal（${n} 件）：`),
    better: (t: string, s: number) => `   ↳ 更顺：${t}（${s} 分），可在 App 里一键改`,
    v: { good: '不错', neutral: '一般', bad: '欠佳' }, allDay: '全天', every: '🔁 重复',
    foot: '打开：https://fatecal.com',
  },
  es: {
    hello: '¡Hola! Soy FateCal. Primero vincula este WhatsApp con tu cuenta: abre fatecal.com → Ajustes → WhatsApp y envíame el código que aparece.',
    linked: '✅ ¡Vinculado! Ahora solo cuéntame tus planes, por ejemplo «médico mañana a las 3pm» o «gimnasio martes y jueves 7pm». Los agrego a FateCal y te digo qué tal el momento.',
    badCode: 'Ese código no funcionó o caducó. Pide uno nuevo en fatecal.com → Ajustes → WhatsApp.',
    unlinked: 'Desvinculado. Tu cuenta de FateCal ya no está conectada a este WhatsApp.',
    noProfile: 'Primero completa tus datos de nacimiento en fatecal.com y vuelve a escribirme.',
    none: 'No encontré una fecha o evento. Prueba «cena con Ana el viernes a las 7pm».',
    voice: 'Por ahora solo leo texto. Consejo: usa el 🎤 del teclado para dictar.',
    limit: (n: number) => `Ya usaste tus ${n} entradas rápidas de hoy. Mejora tu plan en fatecal.com para más.`,
    added: (n: number) => (n === 1 ? '✅ Agregado a FateCal:' : `✅ ${n} agregados a FateCal:`),
    better: (t: string, s: number) => `   ↳ Mejor: ${t} (${s}). Cámbialo en la app con un toque.`,
    v: { good: 'bueno', neutral: 'regular', bad: 'no ideal' }, allDay: 'todo el día', every: '🔁 se repite',
    foot: 'Abrir: https://fatecal.com',
  },
};
const LOC: Record<L, string> = { en: 'en-US', zh: 'zh-CN', es: 'es-ES' };
const guessLang = (text: string, stored?: string): L =>
  stored === 'zh' || stored === 'es' || stored === 'en' ? stored : /[一-鿿]/.test(text) ? 'zh' : /[áéíóúñ¿¡]|\b(mañana|hoy|lunes|martes|cita|cena)\b/i.test(text) ? 'es' : 'en';
// wall-clock "YYYY-MM-DDTHH:mm" shown as text (formatted in UTC so the server's zone doesn't shift it)
const wallLabel = (wall: string, l: L, withTime = true) => new Date(`${wall}:00Z`).toLocaleString(LOC[l], { timeZone: 'UTC', weekday: 'short', month: 'numeric', day: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });

// Meta's webhook check (GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…)
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get('hub.mode') === 'subscribe' && !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  let body: any; try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const msgs: any[] = (body.entry ?? []).flatMap((e: any) => (e.changes ?? []).flatMap((c: any) => c.value?.messages ?? []));
  for (const m of msgs) {
    if (!m?.id || !m.from || (await seen(m.id))) continue;
    await handle(String(m.from), m).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

async function handle(phone: string, m: any) {
  const text: string = m.type === 'text' ? String(m.text?.body ?? '').trim() : '';
  const uid = await uidForPhone(phone);
  const data = uid ? await readUserData(uid) : null;
  const l = guessLang(text, data?.langPick ?? data?.lang);
  const t = M[l];
  if (m.type !== 'text') return void (await sendText(phone, uid ? t.voice : t.hello));

  // link code: "ABC123", "LINK ABC123", "绑定 ABC123"
  const code = text.toUpperCase().replace(/^(LINK|绑定|VINCULAR)\s*/i, '').trim();
  if (/^[A-Z2-9]{6}$/.test(code)) {
    const linked = await useLinkCode(code, phone);
    return void (await sendText(phone, linked ? M[guessLang(text, (await readUserData(linked))?.lang)].linked : t.badCode));
  }
  if (!uid) return void (await sendText(phone, t.hello));
  if (/^(unlink|解绑|desvincular)$/i.test(text)) { await unlink(uid); return void (await sendText(phone, t.unlinked)); }
  if (!data?.profile?.birth) return void (await sendText(phone, t.noProfile));

  const plan = await planFor({ uid, email: uid.startsWith('email:') ? uid.slice(6) : undefined });
  const limit = LIMITS[plan].parsePerDay;
  if ((await readUsageCount(uid, 'parse')) >= limit) return void (await sendText(phone, t.limit(limit)));

  const tz = validTz(data.tz) ? data.tz : 'America/Los_Angeles';
  const now = new Date();
  const r = await parseSentence(text, utcToZoned(now, tz), now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' }));
  if (!r.events.length) return void (await sendText(phone, r.question || t.none));
  await bumpUsage(uid, 'parse');

  // Score in wall-clock time: on this server (UTC) a date whose UTC fields equal the person's local time
  // reads the same hour pillar as their phone would.
  const chart = computeChart(data.profile.birth);
  const wallAll: CalEvent[] = (data.events ?? []).filter((e) => !e.allDay).map((e) => ({ ...e, start: `${utcToZoned(new Date(e.start), tz)}:00Z`, end: `${utcToZoned(new Date(e.end), tz)}:00Z` }));
  const lines: string[] = [t.added(r.events.length)];
  const toSave: CalEvent[] = [];
  r.events.forEach((p, i) => {
    const wallEv: CalEvent = { id: `w${i}`, title: p.title, start: `${p.start}:00Z`, end: `${p.end}:00Z`, allDay: p.allDay, cat: p.cat, source: 'manual' };
    const read = readEvent(chart, wallEv, wallAll);
    const when = p.allDay ? `${wallLabel(p.start, l, false)} · ${t.allDay}` : wallLabel(p.start, l);
    lines.push(`• ${when} ${p.title} — ${read.score} ${t.v[read.verdict]}${p.repeat ? ` ${t.every}` : ''}`);
    const alt = read.alternatives[0];
    if (!p.allDay && !p.repeat && alt && read.verdict !== 'good') {
      const altWall = alt.start.slice(0, 16);
      lines.push(t.better(altWall.slice(0, 10) === p.start.slice(0, 10) ? altWall.slice(11) : wallLabel(altWall, l), alt.score));
    }
    toSave.push({
      id: `m${Date.now()}${i}${Math.random().toString(36).slice(2, 5)}`, title: p.title, cat: p.cat, allDay: p.allDay, source: 'manual', via: 'whatsapp',
      start: p.allDay ? `${p.start.slice(0, 10)}T00:00` : zonedToUtc(p.start, tz).toISOString(),
      end: p.allDay ? `${p.start.slice(0, 10)}T23:59` : zonedToUtc(p.end, tz).toISOString(),
      ...(p.repeat ? { repeat: p.repeat } : {}),
    });
  });
  await addPending(uid, toSave);
  lines.push('', t.foot);
  await sendText(phone, lines.join('\n'));
}
