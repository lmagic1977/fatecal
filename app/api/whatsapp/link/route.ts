import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { maskPhone, newLinkCode, phoneForUid, unlink, waEnabled } from '@/lib/whatsapp';

export const runtime = 'nodejs';

// GET → is WhatsApp available, the number to message, and the linked number (masked)
export async function GET() {
  const u = await currentUser();
  if (!waEnabled()) return NextResponse.json({ enabled: false });
  const phone = u ? await phoneForUid(u.uid) : null;
  return NextResponse.json({ enabled: true, number: process.env.WHATSAPP_NUMBER, linked: phone ? maskPhone(phone) : null });
}
// POST → a fresh 6-character code, valid 30 minutes
export async function POST() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  if (!waEnabled()) return NextResponse.json({ error: 'not_enabled' }, { status: 400 });
  return NextResponse.json({ code: await newLinkCode(u.uid), number: process.env.WHATSAPP_NUMBER });
}
export async function DELETE() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  await unlink(u.uid);
  return NextResponse.json({ ok: true });
}
