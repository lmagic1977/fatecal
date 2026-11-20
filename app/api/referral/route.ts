import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { claim, ensureCode, MAX_MONTHS, readStats } from '@/lib/referral';

export const runtime = 'nodejs';

// GET → my invite code, link and how many friends joined
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  const code = await ensureCode(u.uid);
  return NextResponse.json({ code, link: `https://fatecal.com/?r=${code}`, max: MAX_MONTHS, ...(await readStats(u.uid)) });
}
// POST {code} → the person who just signed up came from this invite
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const code = String(b.code ?? '').trim().toUpperCase().slice(0, 12);
  return NextResponse.json({ result: /^[A-Z2-9]{7}$/.test(code) ? await claim(u.uid, code) : 'invalid' });
}
