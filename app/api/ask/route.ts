import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Small per-instance limiter so a public deployment can't be used to burn the API key.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 12;
}

const SYSTEM = `You are FateBot, the advisor inside FateCal, an app that combines a person's BaZi (Four Pillars) chart with their real schedule.

Rules:
- Base every judgment ONLY on the readings in <context>. Those come from FateCal's rule engine. Never invent a different verdict, score, pillar or rule.
- When asked about a time, find it (or the nearest one) in the scored slots and say whether it is good, neutral or bad, why (using the listed reasons), and the best alternative if it is not good.
- Be concrete: name the day and clock time. Keep answers short: 2 to 5 sentences, or a short list.
- Explain Chinese terms in plain words for English speakers (e.g. "Monkey hour, 3 to 5 PM").
- You may suggest small cultural remedies (a favorable color, direction, or preparing well), but never tell anyone to cancel medical care, ignore legal or financial advice, or make a major purchase or sale because of the chart. For big decisions, frame the chart as one input and say so once.
- If the question is not about timing, the person's chart, feng shui or their schedule, answer briefly and steer back.
- Reply in the language given in <lang> (en = English, zh = Simplified Chinese).`;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'no_key' }, { status: 503 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (limited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.question !== 'string') return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const question = body.question.slice(0, 1000);
  const context = JSON.stringify(body.context ?? {}).slice(0, 30000);
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const lang = body.lang === 'zh' ? 'zh' : 'en';

  const client = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = [
    ...history
      .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .map((m: any) => ({ role: m.role, content: m.text.slice(0, 2000) })),
    { role: 'user', content: `<lang>${lang}</lang>\n<context>${context}</context>\n\n${question}` },
  ];
  // the API requires the first message to be from the user
  while (messages.length && messages[0].role !== 'user') messages.shift();

  try {
    const res = await client.messages.create({
      model: process.env.FATECAL_MODEL || 'claude-haiku-5-5',
      max_tokens: 2000,
      system: SYSTEM,
      messages,
    });
    const text = res.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('').trim();
    return NextResponse.json({ answer: text });
  } catch (e: any) {
    return NextResponse.json({ error: 'ai_failed', detail: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }
}
