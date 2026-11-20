import { del, get, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { INBOUND_DOMAIN, MailItem } from '@/lib/mail';
import { addressToken, validReadKey } from '@/lib/mailkey';
import { MONTHLY_LIMIT, readUsage } from '@/lib/quota';
import { needUser } from '@/lib/guard';

export const runtime = 'nodejs';

// POST { key } -> the forwarding address for this key, plus any new mail (which is then deleted from the server).
export async function POST(req: Request) {
  const denied = await needUser();
  if (denied) return denied;
  const { key, peek } = await req.json().catch(() => ({}));
  if (!validReadKey(key)) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  let token: string;
  try { token = addressToken(key); } catch { return NextResponse.json({ error: 'not_configured' }, { status: 503 }); }
  const address = `${token}@${INBOUND_DOMAIN}`;
  const usage = { used: (await readUsage(token)).n, limit: MONTHLY_LIMIT };
  if (peek) return NextResponse.json({ address, items: [], usage });

  const items: MailItem[] = [];
  try {
    const { blobs } = await list({ prefix: `inbox/${token}/`, limit: 100 });
    for (const b of blobs) {
      const r = await get(b.pathname, { access: 'private', useCache: false });
      if (!r) continue;
      const txt = await new Response(r.stream).text();
      try { items.push(JSON.parse(txt)); } catch { /* skip */ }
    }
    if (blobs.length) await del(blobs.map((b) => b.url));
  } catch {
    return NextResponse.json({ address, items: [], usage, error: 'storage' });
  }
  items.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return NextResponse.json({ address, items, usage });
}
