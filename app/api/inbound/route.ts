import Anthropic from '@anthropic-ai/sdk';
import { put } from '@vercel/blob';
import ical from 'node-ical';
import { NextResponse } from 'next/server';
import { INBOUND_DOMAIN, MailItem, MailKind } from '@/lib/mail';
import { validToken } from '@/lib/mailkey';
import { MONTHLY_LIMIT, countOne, readUsage, writeUsage } from '@/lib/quota';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Postmark inbound webhook. Postmark calls https://fatecal:<INBOUND_SECRET>@fatecal.com/api/inbound
function authorized(req: Request) {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return false;
  const h = req.headers.get('authorization') ?? '';
  if (h.startsWith('Basic ')) {
    const [, pass] = Buffer.from(h.slice(6), 'base64').toString().split(':');
    if (pass === secret) return true;
  }
  return new URL(req.url).searchParams.get('secret') === secret;
}

const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function recipientToken(p: any): string | null {
  const addrs: string[] = [p.OriginalRecipient, ...(p.ToFull ?? []).map((t: any) => t.Email), ...(p.CcFull ?? []).map((t: any) => t.Email), p.To]
    .filter(Boolean).flatMap((a: string) => String(a).split(','));
  for (const a of addrs) {
    const m = a.trim().toLowerCase().match(/([a-z0-9]{14})@in\.fatecal\.com/);
    if (m && validToken(m[1])) return m[1];
  }
  return null;
}

function fromCalendar(p: any): Partial<MailItem> | null {
  const att = (p.Attachments ?? []).find((a: any) => /calendar|\.ics$/i.test(`${a.ContentType} ${a.Name}`));
  if (!att?.Content) return null;
  try {
    const data = ical.sync.parseICS(Buffer.from(att.Content, 'base64').toString('utf8'));
    const ev: any = Object.values(data).find((x: any) => x?.type === 'VEVENT');
    if (!ev?.start) return null;
    const title = typeof ev.summary === 'string' ? ev.summary : ev.summary?.val;
    return {
      kind: 'meeting', title: String(title || p.Subject || 'Meeting').slice(0, 200),
      start: new Date(ev.start).toISOString(), end: ev.end ? new Date(ev.end).toISOString() : undefined,
      allDay: ev.datetype === 'date', location: typeof ev.location === 'string' ? ev.location.slice(0, 200) : undefined,
    };
  } catch {
    return null;
  }
}

const EXTRACT = `Extract the one event that matters from this forwarded email for a scheduling app. Reply with JSON only, no prose:
{"kind":"meeting|order|travel|bill|contract|other","title":"short title in the email's language","start":"YYYY-MM-DDTHH:mm or YYYY-MM-DD or null","end":"same format or null","location":"or null","amount":"e.g. $89.00 or null","merchant":"or null","summary":"one sentence"}
- meeting: invitations, appointments, calls. travel: flights, hotels, trains (start = departure). order: purchases and shipping (start = order or delivery date if given). bill: payments due (start = due date). contract: documents to sign (start = deadline).
- Write start/end in the local time stated in the email, without a time zone. Use null when the email gives no date.`;

async function fromText(subject: string, text: string, received: string): Promise<Partial<MailItem> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: process.env.FATECAL_MODEL || 'claude-haiku-5-5',
      max_tokens: 2000,
      system: EXTRACT,
      messages: [{ role: 'user', content: `Received: ${received}\nSubject: ${subject}\n\n${text.slice(0, 12000)}` }],
    });
    const raw = res.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
    const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const kinds: MailKind[] = ['meeting', 'order', 'travel', 'bill', 'contract', 'other'];
    const clean = (v: unknown, n = 200) => (typeof v === 'string' && v && v !== 'null' ? v.slice(0, n) : undefined);
    const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(v) ? v.slice(0, 16) : undefined);
    const start = date(j.start);
    return {
      kind: kinds.includes(j.kind) ? j.kind : 'other', title: clean(j.title) ?? subject, start, end: date(j.end),
      allDay: !!start && start.length === 10, location: clean(j.location), amount: clean(j.amount, 40), merchant: clean(j.merchant, 80), summary: clean(j.summary, 300) ?? '',
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const p = await req.json().catch(() => null);
  if (!p) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const token = recipientToken(p);
  // Reply 200 for unknown recipients so Postmark does not retry them.
  if (!token) return NextResponse.json({ ok: true, ignored: 'recipient' });

  const from = String(p.FromFull?.Email ?? p.From ?? '').slice(0, 200);
  const subject = String(p.Subject ?? '').slice(0, 300);
  const text = String(p.TextBody || stripHtml(String(p.HtmlBody ?? '')));
  const received = new Date(p.Date ?? Date.now()).toISOString();
  const base = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, receivedAt: received, from, subject };

  const isGmailConfirm = /forwarding-noreply@google\.com/i.test(from) || /gmail forwarding confirmation|forwarding confirmation/i.test(subject);

  // Monthly cap per address (Gmail's forwarding confirmation is always let through).
  if (!isGmailConfirm) {
    const { usage, action } = countOne(await readUsage(token));
    await writeUsage(token, usage);
    if (action !== 'read') {
      if (action === 'notice') {
        const notice: MailItem = { ...base, kind: 'limit', title: 'Monthly limit reached', summary: `More than ${MONTHLY_LIMIT} emails arrived this month.` };
        await put(`inbox/${token}/${notice.id}.json`, JSON.stringify(notice), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      }
      // 200 so Postmark does not retry; the email is not read or stored.
      return NextResponse.json({ ok: true, ignored: 'monthly_limit' });
    }
  }

  let item: MailItem;
  if (isGmailConfirm) {
    // Gmail asks the forwarding address to confirm; show the link to the user so they can approve it.
    const link = text.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s<>"]+/)?.[0];
    const code = subject.match(/#(\d{6,12})/)?.[1] ?? text.match(/Confirmation code:\s*(\d{6,12})/i)?.[1];
    item = { ...base, kind: 'verify', title: 'Gmail forwarding confirmation', summary: 'Gmail needs you to confirm forwarding to FateCal.', verifyLink: link, verifyCode: code };
  } else {
    const ext = fromCalendar(p) ?? (await fromText(subject, text, received)) ?? { kind: 'other' as const, title: subject || '(no subject)', summary: text.slice(0, 200) };
    item = { ...base, summary: '', ...ext } as MailItem;
  }

  await put(`inbox/${token}/${item.id}.json`, JSON.stringify(item), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
  return NextResponse.json({ ok: true, to: `${token}@${INBOUND_DOMAIN}`, kind: item.kind });
}
