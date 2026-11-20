import { NextResponse } from 'next/server';
import { adminEmails, stats } from '@/lib/accounts';
import { renderReport } from '@/lib/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron calls this once a day (see vercel.json) with Authorization: Bearer $CRON_SECRET.
// It emails the sign-up report to REPORT_TO, or to the FATECAL_ADMINS addresses.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const to = (process.env.REPORT_TO || adminEmails().join(',')).trim();
  const s = await stats();
  const r = renderReport(s);
  // ?send=0 → just return the report (used to post it in chat instead of email)
  if (new URL(req.url).searchParams.get('send') === '0') return NextResponse.json({ subject: r.subject, text: r.text });
  if (!to || !process.env.POSTMARK_SERVER_TOKEN) return NextResponse.json({ sent: false, reason: 'no_recipient_or_mail', stats: s });
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN },
    body: JSON.stringify({ From: process.env.MAIL_FROM || 'FateCal <hello@fatecal.com>', To: to, Subject: r.subject, TextBody: r.text, HtmlBody: r.html, MessageStream: 'outbound', Tag: 'daily-report' }),
  }).catch(() => null);
  return NextResponse.json({ sent: !!res?.ok, today: s.today, newToday: s.byDay[0].n, accounts: s.accounts });
}
