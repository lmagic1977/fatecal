import { NextResponse } from 'next/server';
import { SCOPE, exchangeCode, readState, saveToken } from '@/lib/gcal';

export const runtime = 'nodejs';

// Google sends the person back here after they approve (or decline).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const back = (s: string) => NextResponse.redirect(new URL(`/?gcal=${s}`, req.url));
  const key = readState(q.get('state') ?? '');
  if (!key) return back('error');
  if (q.get('error') || !q.get('code')) return back('declined');
  const tok = await exchangeCode(q.get('code')!);
  if (!tok?.refresh_token) return back('error');
  if (!String(tok.scope ?? '').includes(SCOPE)) return back('noscope'); // they unticked calendar access
  let email: string | undefined;
  try { email = JSON.parse(Buffer.from(String(tok.id_token).split('.')[1], 'base64url').toString()).email; } catch { /* optional */ }
  await saveToken(key, { refresh: tok.refresh_token, email });
  return back('connected');
}
