import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { setSource } from '@/lib/accounts';

export const runtime = 'nodejs';

// POST {src} → remember where this new account came from (first touch, once)
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  await setSource(u.uid, String(b.src ?? '')).catch(() => {});
  return NextResponse.json({ ok: true });
}
