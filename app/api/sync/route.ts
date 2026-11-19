import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';

// A signed-in user's FateCal data (chart, events, settings), kept privately so it follows them across devices.
const pathFor = (uid: string) => `users/${createHash('sha256').update(uid).digest('hex').slice(0, 32)}.json`;

async function who() {
  const s: any = await auth();
  return s?.uid ? { uid: s.uid as string, alt: s.alt as string | undefined, name: s.user?.name as string | undefined, email: s.user?.email as string | undefined, image: s.user?.image as string | undefined } : null;
}

export async function GET() {
  const u = await who();
  if (!u) return NextResponse.json({ user: null });
  const read = async (id: string) => {
    try {
      const r = await get(pathFor(id), { access: 'private', useCache: false });
      if (r && 'stream' in r && r.stream) return JSON.parse(await new Response(r.stream).text());
    } catch { /* none yet */ }
    return null;
  };
  // fall back to data saved under the older provider-based id (the next save moves it to the new id)
  const data = (await read(u.uid)) ?? (u.alt && u.alt !== u.uid ? await read(u.alt) : null);
  return NextResponse.json({ user: { name: u.name, email: u.email, image: u.image }, data });
}

export async function PUT(req: Request) {
  const u = await who();
  if (!u) return NextResponse.json({ error: 'signed_out' }, { status: 401 });
  const body = await req.text();
  if (body.length > 400_000) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  try { JSON.parse(body); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  await put(pathFor(u.uid), body, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return NextResponse.json({ ok: true });
}
