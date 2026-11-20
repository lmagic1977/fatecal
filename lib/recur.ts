import type { CalEvent } from './engine';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Expand repeating events into single occurrences between `from` and `to` (local time).
// Occurrences get id `<series id>@<YYYY-MM-DD>` and seriesId = the series id.
export function expandRepeats(events: CalEvent[], from: Date, to: Date, max = 800): CalEvent[] {
  const out: CalEvent[] = [];
  for (const e of events) {
    if (!e.repeat) { out.push(e); continue; }
    const s0 = new Date(e.start), dur = new Date(e.end).getTime() - s0.getTime();
    const until = e.repeat.until ? new Date(`${e.repeat.until}T23:59:59`) : null;
    const skip = new Set(e.exdates ?? []);
    const byDay = e.repeat.freq === 'weekly' ? (e.repeat.byDay?.length ? e.repeat.byDay : [s0.getDay()]) : null;
    let n = 0;
    for (let i = 0; n < max; i++) {
      // walk day by day for daily/weekly, month by month for monthly
      const d = e.repeat.freq === 'monthly'
        ? new Date(s0.getFullYear(), s0.getMonth() + i, s0.getDate(), s0.getHours(), s0.getMinutes())
        : new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + i, s0.getHours(), s0.getMinutes());
      if (d > to || (until && d > until)) break;
      if (e.repeat.freq === 'monthly' && d.getDate() !== s0.getDate()) continue; // e.g. no 31st this month
      if (byDay && !byDay.includes(d.getDay())) continue;
      if (d < from && d.getTime() + dur < from.getTime()) continue;
      const key = ymd(d);
      if (skip.has(key)) continue;
      out.push({ ...e, id: `${e.id}@${key}`, seriesId: e.id, start: d.toISOString(), end: new Date(d.getTime() + dur).toISOString(), exdates: undefined });
      n++;
    }
  }
  return out;
}
export const dateKey = ymd;
