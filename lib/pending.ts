import type { CalEvent } from './engine';
import { h, readJson, removeJson, writeJson } from './store';

// Events added from outside the app (WhatsApp) wait here until the app picks them up and merges them,
// so an open app never overwrites them with its older list.
const path = (uid: string) => `pending/${h(uid)}.json`;
export async function addPending(uid: string, evs: CalEvent[]) {
  const cur = (await readJson<CalEvent[]>(path(uid))) ?? [];
  await writeJson(path(uid), [...cur, ...evs].slice(-200));
}
export async function takePending(uid: string): Promise<CalEvent[]> {
  const cur = (await readJson<CalEvent[]>(path(uid))) ?? [];
  if (cur.length) await removeJson(path(uid));
  return cur;
}
// The person's saved data (profile, events, time zone, language), as the app last synced it.
export interface UserData { profile?: { name: string; birth: any; sex?: string }; events?: CalEvent[]; tz?: string; lang?: string; langPick?: string }
export const readUserData = (uid: string) => readJson<UserData>(`users/${h(uid)}.json`);
