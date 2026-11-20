import webpush from 'web-push';
import { list } from '@vercel/blob';
import { h, readJson, writeJson } from './store';

// Web push (VAPID). Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
let ready = false;
function init() {
  if (ready || !pushEnabled()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@fatecal.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export interface PushPrefs { before: number; morning: boolean; morningHour: number }
export const DEFAULT_PREFS: PushPrefs = { before: 30, morning: true, morningHour: 8 };
export interface PushRec { uid: string; subs: webpush.PushSubscription[]; prefs: PushPrefs; lang: string; tz: string; sent?: Record<string, number> }

const path = (uid: string) => `push/${h(uid)}.json`;
export const readPush = (uid: string) => readJson<PushRec>(path(uid));
export const writePush = (r: PushRec) => writeJson(path(r.uid), r);
export async function allPush(): Promise<PushRec[]> {
  const out: PushRec[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: 'push/', cursor, limit: 1000 });
    for (let i = 0; i < r.blobs.length; i += 50) {
      const recs = await Promise.all(r.blobs.slice(i, i + 50).map((b) => readJson<PushRec>(b.pathname)));
      for (const rec of recs) if (rec?.subs?.length) out.push(rec);
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

// Send to every device of a person; drop devices the browser says are gone (404/410).
export async function sendAll(rec: PushRec, msg: { title: string; body: string; url?: string; tag?: string }) {
  init();
  const keep: webpush.PushSubscription[] = [];
  let sent = 0;
  for (const s of rec.subs) {
    try { await webpush.sendNotification(s, JSON.stringify(msg), { TTL: 3600 }); keep.push(s); sent++; }
    catch (e: any) { if (e?.statusCode !== 404 && e?.statusCode !== 410) keep.push(s); }
  }
  rec.subs = keep;
  return sent;
}
