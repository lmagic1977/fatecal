import { get, put } from '@vercel/blob';

// A monthly cap on forwarded emails per FateCal address. Past the cap we stop reading new mail with the AI
// (and stop storing it), and leave the user one notice suggesting a filter instead of forwarding everything.
// Postmark still counts mail it receives, so the cap protects AI cost and nudges users; the filter is what cuts volume.
export const MONTHLY_LIMIT = Number(process.env.MAIL_MONTHLY_LIMIT) || 300;

export const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const pathFor = (token: string, m = monthKey()) => `quota/${token}/${m}.json`;

export interface Usage { n: number; warned: boolean }

export async function readUsage(token: string): Promise<Usage> {
  try {
    const r = await get(pathFor(token), { access: 'private', useCache: false });
    if (r && 'stream' in r && r.stream) {
      const j = JSON.parse(await new Response(r.stream).text());
      return { n: Number(j.n) || 0, warned: !!j.warned };
    }
  } catch { /* none yet */ }
  return { n: 0, warned: false };
}

export async function writeUsage(token: string, u: Usage) {
  await put(pathFor(token), JSON.stringify(u), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }).catch(() => {});
}

// Count one more email and decide: read it, drop it, or drop it and leave the one-time notice.
export function countOne(u: Usage, limit = MONTHLY_LIMIT): { usage: Usage; action: 'read' | 'drop' | 'notice' } {
  const n = u.n + 1;
  if (n <= limit) return { usage: { ...u, n }, action: 'read' };
  if (!u.warned) return { usage: { n, warned: true }, action: 'notice' };
  return { usage: { ...u, n }, action: 'drop' };
}
