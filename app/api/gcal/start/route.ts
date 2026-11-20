import { NextResponse } from 'next/server';
import { REDIRECT, SCOPE, gcalEnabled, makeState, validKey } from '@/lib/gcal';

export const runtime = 'nodejs';

// GET /api/gcal/start?key=… → Google's consent screen (read-only calendar access)
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!gcalEnabled() || !validKey(key)) return NextResponse.redirect(new URL('/?gcal=error', req.url));
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!, redirect_uri: REDIRECT, response_type: 'code',
    scope: `openid email ${SCOPE}`, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: makeState(key),
  }).toString();
  return NextResponse.redirect(u.toString());
}
