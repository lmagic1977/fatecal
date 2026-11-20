import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ACCOUNTS_ON } from './site';

// When accounts are on, personal features (forwarding address, calendars, FateBot) need a signed-in user.
// Returns a 401 response to send back, or null when the request may go ahead.
export async function needUser(): Promise<NextResponse | null> {
  if (!ACCOUNTS_ON) return null;
  const s = await auth().catch(() => null);
  return (s as any)?.uid ? null : NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
}
