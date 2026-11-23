'use client';
import type { CalEvent } from './engine';

// Bridge to the FateCal iOS/Android app (Capacitor). On the website these all return "not available".
const cap = () => (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
export const isNativeApp = () => !!cap()?.isNativePlatform?.();
export const nativePlatform = (): 'ios' | 'android' | 'web' => (isNativeApp() ? cap().getPlatform() : 'web');
export const isIosApp = () => nativePlatform() === 'ios';
const plugin = (name: string) => cap()?.Plugins?.[name];

// ---- phone calendar (read only) ----
export async function phoneCalendarAllowed(ask: boolean): Promise<boolean> {
  const C = plugin('CapacitorCalendar');
  if (!C) return false;
  try {
    if (!ask) {
      const r = await C.checkPermission?.({ scope: 'readCalendar' });
      return r?.result === 'granted';
    }
    const r = nativePlatform() === 'ios' ? await C.requestFullCalendarAccess() : await C.requestReadOnlyCalendarAccess();
    return r?.result === 'granted';
  } catch { return false; }
}
export async function phoneCalendarEvents(daysBack = 2, daysAhead = 60): Promise<CalEvent[]> {
  const C = plugin('CapacitorCalendar');
  if (!C) return [];
  const now = Date.now();
  const r = await C.listEventsInRange({ from: now - daysBack * 86400000, to: now + daysAhead * 86400000 });
  return (r?.result ?? []).filter((e: any) => e?.title && e.startDate).map((e: any) => {
    const allDay = !!e.isAllDay;
    const s = new Date(e.startDate), en = new Date(e.endDate || e.startDate);
    const local = (d: Date, end = false) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${end ? '23:59' : '00:00'}`;
    return {
      id: `p:${e.id}:${e.startDate}`, title: String(e.title).slice(0, 200), allDay, source: 'calendar' as const, from: 'phone',
      start: allDay ? local(s) : s.toISOString(), end: allDay ? local(s, true) : en.toISOString(),
    };
  });
}

// ---- local reminders (no server needed) ----
export async function notificationsAllowed(ask: boolean): Promise<boolean> {
  const N = plugin('LocalNotifications');
  if (!N) return false;
  try { const r = ask ? await N.requestPermissions() : await N.checkPermissions(); return r?.display === 'granted'; } catch { return false; }
}
export interface Reminder { id: number; title: string; body: string; at: Date }
// Replace every reminder FateCal scheduled before with this list.
export async function setReminders(list: Reminder[]) {
  const N = plugin('LocalNotifications');
  if (!N) return;
  try {
    const pending = await N.getPending();
    if (pending?.notifications?.length) await N.cancel({ notifications: pending.notifications.map((n: any) => ({ id: n.id })) });
    const future = list.filter((r) => r.at.getTime() > Date.now() + 30000).slice(0, 60);
    if (future.length) await N.schedule({ notifications: future.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true } })) });
  } catch { /* ignore */ }
}
export const hashId = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000; };

// ---- voice input (phone app only; needs the SpeechRecognition plugin in the installed build) ----
export const nativeSpeechReady = () => isNativeApp() && !!plugin('SpeechRecognition');
let speechSubs: any[] = [];
let silence: ReturnType<typeof setTimeout> | undefined;
export async function stopNativeSpeech() {
  clearTimeout(silence);
  try { await plugin('SpeechRecognition')?.stop(); } catch {}
}
/** Listen once. onText gets the running transcript; onEnd gets the final text ('' if nothing / denied). */
export async function startNativeSpeech(locale: string, onText: (s: string) => void, onEnd: (s: string, denied?: boolean) => void) {
  const S = plugin('SpeechRecognition');
  if (!S) return onEnd('');
  try {
    const p = await S.requestPermissions();
    if (p?.speechRecognition !== 'granted') return onEnd('', true);
  } catch { return onEnd('', true); }
  for (const s of speechSubs) try { await s.remove(); } catch {}
  speechSubs = [];
  let text = '', done = false;
  const finish = () => { if (done) return; done = true; clearTimeout(silence); for (const s of speechSubs) try { s.remove(); } catch {} speechSubs = []; onEnd(text.trim()); };
  const arm = () => { clearTimeout(silence); silence = setTimeout(() => { S.stop().catch(() => {}); finish(); }, 1800); };
  speechSubs.push(await S.addListener('partialResults', (e: any) => {
    const cur = e?.accumulatedText ?? `${e?.accumulated ?? ''}${e?.matches?.[0] ?? ''}`;
    if (cur) { text = cur; onText(cur); arm(); }
  }));
  speechSubs.push(await S.addListener('listeningState', (e: any) => { if ((e?.state ?? e?.status) === 'stopped') finish(); }));
  try {
    await S.start({ language: locale, partialResults: true, popup: false, addPunctuation: false });
    silence = setTimeout(() => { S.stop().catch(() => {}); finish(); }, 8000); // nothing said at all
  } catch { finish(); }
}

// iOS builds 1–2 shipped without camera/photo permission text, and iOS closes the app if a photo is picked there.
let iosBuild = 0;
if (typeof window !== 'undefined') setTimeout(() => { if (isIosApp()) plugin('App')?.getInfo?.().then((i: any) => { iosBuild = Number(i?.build) || 0; }).catch(() => {}); }, 0);
export const photosOk = () => !isIosApp() || iosBuild >= 3;
