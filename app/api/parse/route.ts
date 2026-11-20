import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { bumpUsage, planFor, readUsageCount } from '@/lib/billing';
import { LIMITS } from '@/lib/plans';
import { parseSentence, utcToZoned, validTz, zonedToUtc } from '@/lib/parse';

export const runtime = 'nodejs';

// POST {text, tz} → events parsed from one sentence, with real ISO times. Nothing is saved here;
// the app shows a confirm card first.
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const text = String(b.text ?? '').trim().slice(0, 600);
  const tz = validTz(b.tz) ? b.tz : 'America/Los_Angeles';
  if (!text) return NextResponse.json({ events: [] });
  const plan = await planFor(u);
  if ((await readUsageCount(u.uid, 'parse')) >= LIMITS[plan].parsePerDay) return NextResponse.json({ error: 'daily_limit', limit: LIMITS[plan].parsePerDay }, { status: 429 });
  const nowLocal = utcToZoned(new Date(), tz);
  const weekday = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });
  const r = await parseSentence(text, nowLocal, weekday).catch(() => ({ events: [], question: undefined }));
  if (r.events.length) await bumpUsage(u.uid, 'parse');
  return NextResponse.json({
    question: r.question,
    events: r.events.map((e) => ({
      title: e.title, cat: e.cat, allDay: e.allDay, repeat: e.repeat, assumed: e.assumed,
      start: e.allDay ? `${e.start.slice(0, 10)}T00:00` : zonedToUtc(e.start, tz).toISOString(),
      end: e.allDay ? `${e.start.slice(0, 10)}T23:59` : zonedToUtc(e.end, tz).toISOString(),
    })),
  });
}
