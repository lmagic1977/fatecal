import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { takePending } from '@/lib/pending';

export const runtime = 'nodejs';

// GET → events added from WhatsApp since the app last checked (handed over once, then cleared)
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ events: [] });
  return NextResponse.json({ events: await takePending(u.uid) });
}
