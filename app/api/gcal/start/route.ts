import { NextResponse } from 'next/server';
import { REDIRECT, SCOPE, gcalEnabled, makeState, validKey } from '@/lib/gcal';
import { needUser } from '@/lib/guard';
import { currentUser } from '@/lib/guard';
import { planFor } from '@/lib/billing';
import { LIMITS } from '@/lib/plans';
import { ACCOUNTS_ON } from '@/lib/site';

export const runtime = 'nodejs';

// GET /api/gcal/start?key=… → Google's consent screen (read-only calendar access)
export async function GET(req: Request) {
  if (await needUser()) return NextResponse.redirect(new URL('/?gcal=error', req.url));
  const me = ACCOUNTS_ON ? await currentUser() : null;
  const allowed = !me || LIMITS[await planFor(me)].syncCalendar;
  if (!allowed) return NextResponse.redirect(new URL('/?gcal=upgrade', req.url));
  const key = new URL(req.url).searchParams.get('key');
  if (!gcalEnabled() || !validKey(key)) return NextResponse.redirect(new URL('/?gcal=error', req.url));
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!, redirect_uri: REDIRECT, response_type: 'code',
    scope: `openid email ${SCOPE}`, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: makeState(key),
  }).toString();
  return NextResponse.redirect(u.toString());
}
