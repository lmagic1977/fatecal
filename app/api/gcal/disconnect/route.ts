import { NextResponse } from 'next/server';
import { dropToken, validKey } from '@/lib/gcal';
import { needUser } from '@/lib/guard';

export const runtime = 'nodejs';

// POST { key } → revoke Google access and delete the stored token
export async function POST(req: Request) {
  const denied = await needUser();
  if (denied) return denied;
  const { key } = await req.json().catch(() => ({}));
  if (!validKey(key)) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  await dropToken(key);
  return NextResponse.json({ ok: true });
}
