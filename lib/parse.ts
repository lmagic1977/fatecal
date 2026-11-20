import Anthropic from '@anthropic-ai/sdk';
import type { Category, Repeat } from './engine';

// Turn one sentence ("明天下午看医生", "gym every Tue and Thu 7pm", "cena con Ana el sábado") into events.
// Times come back as local wall-clock strings (YYYY-MM-DDTHH:mm) in the person's own time zone.
export interface Parsed { title: string; start: string; end: string; allDay: boolean; cat: Category; repeat?: Repeat; assumed?: string }
export interface ParseResult { events: Parsed[]; question?: string }

const CATS: Category[] = ['meeting', 'signing', 'travel', 'moving', 'money', 'build', 'wedding', 'medical', 'conception', 'romance', 'opening', 'haircut', 'study', 'cleaning', 'general'];

const SYSTEM = `You turn what a person says into calendar events for a scheduling app. Reply with JSON only:
{"events":[{"title":"short title in the person's language, keep names of people and places","date":"YYYY-MM-DD","start":"HH:mm or null for all-day","end":"HH:mm or null","cat":"one of ${CATS.join('|')}","repeat":null or {"freq":"daily|weekly|monthly","byDay":[0-6, 0=Sunday],"until":"YYYY-MM-DD or null"},"assumed":"what you guessed, in the person's language, or null"}],"question":"only if nothing usable was said: one short question in the person's language, else null"}
Rules:
- Resolve relative dates (today, tomorrow, 后天, this Saturday, 下周三, el viernes) against NOW. "This/本周X" = the next such day on or after today; "next/下周X" = that day in the following week.
- Vague times: morning/上午/mañana 09:00, noon/中午 12:00, afternoon/下午/tarde 14:00, evening/晚上/noche 19:00, night 20:00. Movie or dinner without a time: 19:00. Gym without a time: 18:00. Doctor without a time: 10:00. Put the guess in "assumed".
- If no end is given: meals 1.5h, movies 2.5h, gym 1h, doctor 1h, flights 3h, otherwise 1h. Birthdays, holidays and deadlines are all-day.
- Category: doctor/dentist/hospital/check-up=medical; flight/trip/train=travel; contract/sign=signing; investing, stocks, crypto, bank, loan=money; date, romantic dinner=romance; wedding=wedding; moving house=moving; interview, client, meeting, dinner with someone=meeting; class, exam=study; haircut=haircut; shop opening, launch=opening; renovation=build; cleaning=cleaning; anything else (movie, gym, errands)=general.
- Several things in one sentence become several events. Repeating things ("every Tuesday", "每天", "cada lunes") get repeat and the first date.
- Never invent events the person did not mention.`;

export async function parseSentence(text: string, nowLocal: string, weekday: string): Promise<ParseResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { events: [] };
  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: process.env.FATECAL_MODEL || 'claude-haiku-5-5',
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: `NOW: ${nowLocal} (${weekday})\nSAID: ${text.slice(0, 600)}` }],
  });
  const raw = res.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
  let j: any;
  try { j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { return { events: [] }; }
  const str = (v: unknown, n = 120) => (typeof v === 'string' && v && v !== 'null' ? v.slice(0, n) : undefined);
  const hm = (v: unknown) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : undefined);
  const events: Parsed[] = [];
  for (const e of Array.isArray(j.events) ? j.events.slice(0, 8) : []) {
    const date = typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
    const title = str(e.title);
    if (!date || !title) continue;
    const s = hm(e.start), en = hm(e.end);
    const allDay = !s;
    const start = allDay ? `${date}T00:00` : `${date}T${s}`;
    let end = allDay ? `${date}T23:59` : en ? `${date}T${en}` : addMin(start, 60);
    if (!allDay && end <= start) end = addMin(start, 60);
    const r = e.repeat && ['daily', 'weekly', 'monthly'].includes(e.repeat.freq)
      ? { freq: e.repeat.freq, byDay: Array.isArray(e.repeat.byDay) ? e.repeat.byDay.filter((x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 6) : undefined, until: typeof e.repeat.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.repeat.until) ? e.repeat.until : undefined } as Repeat
      : undefined;
    events.push({ title, start, end, allDay, cat: CATS.includes(e.cat) ? e.cat : 'general', repeat: r, assumed: str(e.assumed, 160) });
  }
  return { events, question: events.length ? undefined : str(j.question, 200) };
}

// "YYYY-MM-DDTHH:mm" + minutes, staying in wall-clock time
export function addMin(local: string, min: number) {
  const d = new Date(`${local}:00Z`);
  return new Date(d.getTime() + min * 60000).toISOString().slice(0, 16);
}

// Wall-clock time in a time zone → real UTC instant.
export function zonedToUtc(local: string, tz: string): Date {
  const guess = new Date(`${local}:00Z`);
  const off = (d: Date) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime();
  };
  let t = guess.getTime() - off(guess);
  t = guess.getTime() - off(new Date(t));
  return new Date(t);
}
// Real instant → wall-clock "YYYY-MM-DDTHH:mm" in a time zone
export function utcToZoned(d: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export const validTz = (tz: unknown): tz is string => { try { return typeof tz === 'string' && !!new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return false; } };
