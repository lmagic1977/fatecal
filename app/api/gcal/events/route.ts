import { NextResponse } from 'next/server';
import { accessToken, loadToken, validKey } from '@/lib/gcal';

export const runtime = 'nodejs';

// POST { key } → events from all the person's visible Google calendars, from 2 days ago to 60 days ahead.
export async function POST(req: Request) {
  const { key } = await req.json().catch(() => ({}));
  if (!validKey(key)) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  const s = await loadToken(key);
  if (!s) return NextResponse.json({ connected: false });
  const at = await accessToken(s.refresh);
  if (!at) return NextResponse.json({ connected: false, error: 'expired' });
  const auth = { authorization: `Bearer ${at}` };
  const g = (path: string) => fetch(`https://www.googleapis.com/calendar/v3/${path}`, { headers: auth, signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  const list = await g('users/me/calendarList?minAccessRole=reader&maxResults=50');
  const cals: { id: string; summary?: string }[] = (list?.items ?? []).filter((c: any) => c.selected !== false && !c.hidden).slice(0, 15);
  if (!cals.length) cals.push({ id: 'primary' });
  const timeMin = new Date(Date.now() - 2 * 86400e3).toISOString();
  const timeMax = new Date(Date.now() + 60 * 86400e3).toISOString();
  const out: { id: string; title: string; start: string; end: string; allDay: boolean; source: 'calendar' }[] = [];
  await Promise.all(cals.map(async (c) => {
    const j = await g(`calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&fields=items(id,summary,start,end,status,transparency)`);
    for (const e of j?.items ?? []) {
      if (e.status === 'cancelled') continue;
      const allDay = !!e.start?.date;
      // all-day dates are local calendar days: keep them as local midnight
      const start = allDay ? new Date(`${e.start.date}T00:00`).toISOString() : e.start?.dateTime;
      const end = allDay ? new Date(`${e.end?.date ?? e.start.date}T00:00`).toISOString() : e.end?.dateTime ?? start;
      if (!start) continue;
      out.push({ id: `g-${e.id}`, title: String(e.summary || 'Busy').slice(0, 200), start: new Date(start).toISOString(), end: new Date(end).toISOString(), allDay, source: 'calendar' });
    }
  }));
  const seen = new Set<string>();
  const events = out.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 600);
  return NextResponse.json({ connected: true, email: s.email, calendars: cals.length, events });
}
