import { createHash } from 'node:crypto';
import { del, get, put } from '@vercel/blob';

// Small private JSON records in Blob.
export const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const r = await get(path, { access: 'private', useCache: false });
    if (r && 'stream' in r && r.stream) return JSON.parse(await new Response(r.stream).text());
  } catch { /* none */ }
  return null;
}
export const writeJson = (path: string, v: unknown) => put(path, JSON.stringify(v), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
export const removeJson = (path: string) => del(path).catch(() => {});
