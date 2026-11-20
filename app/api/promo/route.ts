import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { promoLeft, redeem } from '@/lib/billing';

export const runtime = 'nodejs';

// GET ?code=X → how many places are left (public, for the landing banner)
export async function GET(req: Request) {
  const code = (new URL(req.url).searchParams.get('code') ?? '').trim().toUpperCase();
  return NextResponse.json({ left: await promoLeft(code) });
}

// POST {code} → give the signed-in person the free plan for the code's length
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await redeem(u.uid, String(body.code ?? '').slice(0, 40));
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
