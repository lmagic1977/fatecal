import ical from 'node-ical';
import { NextResponse } from 'next/server';
import { needUser } from '@/lib/guard';

export const runtime = 'nodejs';

const MAX_BYTES = 3 * 1024 * 1024;

// Only public https calendar feeds: no IP literals or local hostnames, so the route cannot be pointed at internal services.
function allowed(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw.trim().replace(/^webcal:\/\//i, 'https://')); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^[\d.]+$/.test(h) || h.includes(':')) return null;
  return u;
}

export async function POST(req: Request) {
  const denied = await needUser();
  if (denied) return denied;
  const { url, days = 14 } = await req.json().catch(() => ({}));
  const u = typeof url === 'string' ? allowed(url) : null;
  if (!u) return NextResponse.json({ error: 'invalid_url' }, { status: 400 });

  let text: string;
  try {
    const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { accept: 'text/calendar' } });
    if (!res.ok) return NextResponse.json({ error: 'fetch_failed', status: res.status }, { status: 502 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
    text = new TextDecoder().decode(buf);
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
  if (!text.includes('BEGIN:VCALENDAR')) return NextResponse.json({ error: 'not_calendar' }, { status: 422 });

  const from = new Date(Date.now() - 24 * 3600e3);
  const to = new Date(Date.now() + Math.min(Number(days) || 14, 31) * 24 * 3600e3);
  const out: { id: string; title: string; start: string; end: string; allDay: boolean; source: 'calendar' }[] = [];
  try {
    const data = ical.sync.parseICS(text);
    for (const [key, item] of Object.entries(data)) {
      if (!item || (item as any).type !== 'VEVENT') continue;
      const ev = item as any;
      let instances: any[] = [];
      try {
        instances = ical.expandRecurringEvent(ev, { from, to, maxIterations: 2000 });
      } catch {
        continue;
      }
      for (const inst of instances) {
        const start = new Date(inst.start), end = inst.end ? new Date(inst.end) : new Date(start.getTime() + 3600e3);
        if (end < from || start > to) continue;
        const title = typeof inst.summary === 'string' ? inst.summary : inst.summary?.val ?? 'Busy';
        out.push({ id: `${key}-${start.getTime()}`, title: String(title).slice(0, 200), start: start.toISOString(), end: end.toISOString(), allDay: !!inst.isFullDay, source: 'calendar' });
        if (out.length > 500) break;
      }
    }
  } catch {
    return NextResponse.json({ error: 'parse_failed' }, { status: 422 });
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return NextResponse.json({ events: out });
}
