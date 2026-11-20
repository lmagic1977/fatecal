import { NextResponse } from 'next/server';
import { computeChart, readEvent, scoreDay, type CalEvent } from '@/lib/engine';
import { expandRepeats } from '@/lib/recur';
import { utcToZoned, validTz } from '@/lib/parse';
import { readUserData } from '@/lib/pending';
import { readJson, h } from '@/lib/store';
import { allPush, sendAll, writePush } from '@/lib/push';
import { T, type Lang } from '@/lib/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs every 5 minutes (vercel.json). For each person with reminders on:
//  - an event reminder `before` minutes ahead of each timed event they added in FateCal
//  - a short morning reading at their chosen hour
// All times are compared in the person's own wall-clock time; on this UTC server a Date whose
// UTC fields equal their local time scores the same as on their phone.
const W = (wall: string) => new Date(`${wall}:00Z`);
const hm = (d: Date) => d.toISOString().slice(11, 16);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const recs = await allPush();
  let sent = 0;
  // 25 people at a time, so a few thousand fit in one run
  for (let i = 0; i < recs.length; i += 25) {
    const r = await Promise.all(recs.slice(i, i + 25).map((rec) => remindOne(rec).catch(() => 0)));
    sent += r.reduce((a, b) => a + b, 0);
  }
  return NextResponse.json({ people: recs.length, sent });
}

async function remindOne(rec: Awaited<ReturnType<typeof allPush>>[number]) {
  const data = await readUserData(rec.uid);
  if (!data?.profile?.birth) return 0;
  const lang = (['en', 'zh', 'es'].includes(String(data.langPick ?? data.lang ?? rec.lang)) ? (data.langPick ?? data.lang ?? rec.lang) : 'en') as Lang;
  const t = T[lang];
  const tz = validTz(data.tz) ? data.tz : rec.tz;
  const chart = computeChart(data.profile.birth);
  const nowWall = W(utcToZoned(new Date(), tz));
  const sentLog = { ...(rec.sent ?? {}) };
  const subCount = rec.subs.length;
  let n = 0;

  // events: saved ones plus any still waiting from WhatsApp, in wall-clock time, repeats expanded
  const pending = (await readJson<CalEvent[]>(`pending/${h(rec.uid)}.json`)) ?? [];
  const wall = [...(data.events ?? []), ...pending].filter((e) => !e.allDay).map((e) => ({ ...e, start: `${utcToZoned(new Date(e.start), tz)}:00.000Z`, end: `${utcToZoned(new Date(e.end), tz)}:00.000Z` }));
  const evs = expandRepeats(wall, new Date(nowWall.getTime() - 86400000), new Date(nowWall.getTime() + 2 * 86400000));

  // 1) event reminders
  if (rec.prefs.before > 0) {
    const lo = nowWall.getTime() + (rec.prefs.before - 10) * 60000, hi = nowWall.getTime() + rec.prefs.before * 60000;
    for (const e of evs) {
      const s = new Date(e.start).getTime();
      const key = `${e.id}@${e.start}`;
      if (s <= lo || s > hi || sentLog[key]) continue;
      const r = readEvent(chart, e, evs);
      const alt = r.alternatives[0];
      const mins = Math.round((s - nowWall.getTime()) / 60000);
      const title = lang === 'zh' ? `${mins} 分钟后：${e.title}` : lang === 'es' ? `En ${mins} min: ${e.title}` : `In ${mins} min: ${e.title}`;
      let body = `${hm(new Date(e.start))} · ${r.score} ${t[r.verdict]}`;
      if (r.verdict === 'bad') body += lang === 'zh' ? '。放慢一点，做好准备。' : lang === 'es' ? '. Ve con calma y prepárate bien.' : '. Take it slow and prepare well.';
      if (r.verdict !== 'good' && alt && alt.start.slice(0, 10) === e.start.slice(0, 10)) body += lang === 'zh' ? ` 更顺：${hm(new Date(alt.start))}（${alt.score}）` : lang === 'es' ? ` Mejor: ${hm(new Date(alt.start))} (${alt.score})` : ` Better: ${hm(new Date(alt.start))} (${alt.score})`;
      n += await sendAll(rec, { title, body, url: '/', tag: key });
      sentLog[key] = Date.now();
    }
  }

  // 2) morning reading, once a day in the first 15 minutes of the chosen hour
  const today = nowWall.toISOString().slice(0, 10);
  if (rec.prefs.morning && nowWall.getUTCHours() === rec.prefs.morningHour && nowWall.getUTCMinutes() < 15 && !sentLog[`am:${today}`]) {
    const d = scoreDay(chart, W(`${today}T12:00`));
    const best = d.bestHours[0];
    const count = evs.filter((e) => e.start.slice(0, 10) === today).length;
    const p2 = (x: number) => `${String(x).padStart(2, '0')}:00`;
    const title = lang === 'zh' ? `今天 ${d.score} 分 · ${t[d.verdict]}` : lang === 'es' ? `Hoy: ${d.score} · ${t[d.verdict]}` : `Today: ${d.score} · ${t[d.verdict]}`;
    const body = [
      t.verdictLine[d.verdict].replace('{w}', '今天'),
      best ? (lang === 'zh' ? `最顺 ${p2(best.start)}–${p2(best.start + 2)}` : lang === 'es' ? `Mejor franja ${p2(best.start)}–${p2(best.start + 2)}` : `Best window ${p2(best.start)}–${p2(best.start + 2)}`) : '',
      count ? (lang === 'zh' ? `今天有 ${count} 个日程` : lang === 'es' ? `${count} evento${count > 1 ? 's' : ''} hoy` : `${count} event${count > 1 ? 's' : ''} today`) : '',
    ].filter(Boolean).join(lang === 'zh' ? '。' : '. ');
    n += await sendAll(rec, { title, body, url: '/', tag: `am:${today}` });
    sentLog[`am:${today}`] = Date.now();
  }

  // keep two days of history so nothing is sent twice; write only when something changed
  const cutoff = Date.now() - 2 * 86400000;
  const before = JSON.stringify(rec.sent ?? {}), subsBefore = subCount;
  rec.sent = Object.fromEntries(Object.entries(sentLog).filter(([, v]) => v > cutoff));
  if (JSON.stringify(rec.sent) !== before || rec.subs.length !== subsBefore) await writePush(rec);
  return n;
}
