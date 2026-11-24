'use client';

import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BirthInput, CalEvent, Category, Chart, computeChart, readEvent, scoreDay, dayActivities, activityName, reasonText, ANIMAL_ES, STEM, BRANCH, ELEMENT_NAME, Element, HIDDEN,
} from '@/lib/engine';
import { T, Lang, almanac } from '@/lib/i18n';
import { buildContext, fallbackAnswer, fmtDay, fmtHour } from '@/lib/bot';
import Footer from '@/components/Footer';
import { signIn, signOut } from 'next-auth/react';
import ShoppingResources from '@/components/ShoppingResources';
import { CONTACT_EMAIL, ACCOUNTS_ON, SHOPPING_ON } from '@/lib/site';
import type { MailItem } from '@/lib/mail';
import { expandRepeats, dateKey } from '@/lib/recur';
import { isNativeApp, isIosApp, phoneCalendarAllowed, phoneCalendarEvents, notificationsAllowed, setReminders, hashId, nativeSpeechReady, startNativeSpeech, stopNativeSpeech, photosOk, type Reminder } from '@/lib/native';
import { LIMITS, PRICES, TRIAL_DAYS, money, type Interval, type Limits, type Plan } from '@/lib/plans';
import { trackMeta, trackMetaOnce, markRegistrationPending, consumeRegistrationPending } from '@/lib/meta';

// ---------------- billing ----------------
interface BillInfo { plan: Plan; limits: Limits; billing: boolean; premiumOpen: boolean; status?: string; interval?: Interval; periodEnd?: string; trialEnd?: string; cancelAtPeriodEnd?: boolean; trialAvailable?: boolean; hasCustomer?: boolean; askedToday?: number; grantUntil?: string }
const PROMO_KEY = 'fatecal.promo';
const REF_KEY = 'fatecal.ref';
const SRC_KEY = 'fatecal.src';
const FREE_INFO: BillInfo = { plan: 'free', limits: LIMITS.free, billing: false, premiumOpen: false };
const Bill = createContext<{ info: BillInfo; upgrade: (plan?: 'basic' | 'premium', interval?: Interval) => void; manage: () => void; refresh: () => void }>({ info: FREE_INFO, upgrade: () => {}, manage: () => {}, refresh: () => {} });
const useBill = () => useContext(Bill);

function Locked({ lang, text }: { lang: Lang; text: string }) {
  const { upgrade } = useBill();
  const b = T[lang].bill;
  return (
    <div className="locked">
      <span>🔒 {text}</span>
      {!isIosApp() && <button className="link" onClick={() => upgrade('basic')}>{b.upgrade(b.basic)} →</button>}
    </div>
  );
}
import { Sex, Dir, DIRS, DIR_NAME, DIR_ELEMENT, STAR8, FLY, FLY_PLAIN, kuaOf, annualStars, liChunYear, yearGanZhi, readHome, dirFromDegrees } from '@/lib/fengshui';

interface Profile { name: string; birth: BirthInput; place: string; sex?: Sex }
type Tab = 'today' | 'ask' | 'home' | 'chart' | 'settings';
type Pic = { media_type: string; data: string; preview: string };
interface Seed { q: string; photo?: Pic }
// the Li Chun year of birth, which feng shui uses (births before about Feb 4 count as the previous year)
const birthFsYear = (b: BirthInput) => liChunYear(new Date(b.year, b.month - 1, b.day, b.hourUnknown ? 12 : b.hour, b.hourUnknown ? 0 : b.minute));
interface Msg { role: 'user' | 'assistant'; text: string; image?: string; upsell?: boolean }

const K = { langPick: 'fatecal.langpick', owner: 'fatecal.owner', profile: 'fatecal.profile', events: 'fatecal.events', ics: 'fatecal.ics', lang: 'fatecal.lang', mailKey: 'fatecal.mailkey', mailAddr: 'fatecal.mailaddr', mail: 'fatecal.mail', mailEdits: 'fatecal.mailedits', gcalKey: 'fatecal.gcalkey', gcal: 'fatecal.gcal', phoneCal: 'fatecal.phonecal', nativeRem: 'fatecal.nativerem', chat: 'fatecal.chat' };

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const tLocale = (lang: Lang) => (lang === 'zh' ? 'zh-CN' : lang === 'es' ? 'es-ES' : 'en-US');
// pick the string for the current language
const L3 = <A,>(lang: Lang, en: A, zh: A, es: A) => (lang === 'zh' ? zh : lang === 'es' ? es : en);
const fmtTime = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(tLocale(lang), { hour: 'numeric', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');
const isoLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" are local wall times; anything with an offset is absolute.
const parseMailTime = (v: string) => (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? new Date(v) : new Date(v.length === 10 ? `${v}T00:00` : v));
// what each kind of forwarded email is, for judging its date
const MAIL_CAT: Partial<Record<MailItem['kind'], Category>> = { meeting: 'meeting', travel: 'travel', order: 'money', bill: 'money', contract: 'signing' };
const mailToEvent = (m: MailItem): CalEvent | null => {
  if (!m.start || m.kind === 'verify' || m.kind === 'limit') return null;
  const s = parseMailTime(m.start);
  if (isNaN(s.getTime())) return null;
  const allDay = !!m.allDay || m.start.length === 10;
  const e = m.end ? parseMailTime(m.end) : new Date(s.getTime() + (allDay ? 24 : 1) * 3600e3);
  return { id: `mail-${m.id}`, title: m.title, start: s.toISOString(), end: (isNaN(e.getTime()) ? new Date(s.getTime() + 3600e3) : e).toISOString(), allDay, source: 'email', from: m.from, cat: MAIL_CAT[m.kind] };
};

export default function App({ initialLang = "en", pathLang }: { initialLang?: Lang; pathLang?: Lang }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>(initialLang);
  // null = follow the phone/computer language; 'en' | 'zh' = the person chose it (kept and synced)
  const [langPick, setLangPick] = useState<Lang | null>(null);
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    document.title = lang === 'zh' ? '随身吉历 FateCal：给重要的事，挑个好时间' : lang === 'es' ? 'FateCal: Mejor momento. Mejores planes.' : 'FateCal: Better timing. Better plans. Powered by BaZi';
  }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); setLangPick(l); save(K.langPick, l); };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [manual, setManual] = useState<CalEvent[]>([]);
  const [ics, setIcs] = useState<{ url: string; events: CalEvent[]; at?: string } | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [mail, setMail] = useState<MailItem[]>([]);
  const [mailKey, setMailKey] = useState<string | null>(null);
  const [mailAddr, setMailAddr] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [seed, setSeed] = useState<Seed | null>(null);
  // changes the user made to events that came from email: a new time, or null when removed
  const [mailEdits, setMailEdits] = useState<Record<string, { start: string; end: string } | null>>({});
  // Google Calendar (read-only): the browser's key, and the last events we read
  const [gcalKey, setGcalKey] = useState<string | null>(null);
  const [gcal, setGcal] = useState<GcalState | null>(null);
  // In the FateCal phone app: the phone's own calendar and local reminders
  const [native, setNative] = useState(false);
  const [phoneOn, setPhoneOn] = useState(false);
  const [phoneEvents, setPhoneEvents] = useState<CalEvent[]>([]);
  const [rem, setRem] = useState<NativeRem>({ on: false, before: 30, morning: true });
  const [bill, setBill] = useState<BillInfo>(FREE_INFO);
  const [billNote, setBillNote] = useState('');
  const [mailUsage, setMailUsage] = useState<{ used: number; limit: number } | null>(null);
  const [authed, setAuthed] = useState<'checking' | 'out' | 'in'>('checking');
  const synced = useRef(false);

  useEffect(() => {
    const picked = load<Lang | null>(K.langPick, null);
    setLangPick(picked);
    setLangState(pathLang ?? picked ?? deviceLang());
    setProfile(load<Profile | null>(K.profile, null));
    setManual(load<CalEvent[]>(K.events, []));
    setIcs(load(K.ics, null));
    setMail(load<MailItem[]>(K.mail, []));
    setMailEdits(load(K.mailEdits, {}));
    setGcalKey(load<string | null>(K.gcalKey, null));
    setGcal(load<GcalState | null>(K.gcal, null));
    setMailKey(load<string | null>(K.mailKey, null));
    setMailAddr(load<string | null>(K.mailAddr, null));
    const qs = new URLSearchParams(location.search);
    const code = qs.get('code'), ref = qs.get('r');
    // first-touch source: utm_source, else a Facebook/Instagram click id, else the referring site
    try {
      if (!localStorage.getItem(SRC_KEY)) {
        const rf = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
        const src = qs.get('utm_source') || (qs.get('fbclid') ? 'facebook' : '') || (ref ? 'invite' : '') || (code ? 'giftcode' : '') || (rf && !rf.endsWith('fatecal.com') ? rf : '');
        if (src) localStorage.setItem(SRC_KEY, src.slice(0, 40));
      }
    } catch { /* private mode */ }
    try {
      if (code) localStorage.setItem(PROMO_KEY, code.trim().toUpperCase().slice(0, 40));
      if (ref) localStorage.setItem(REF_KEY, ref.trim().toUpperCase().slice(0, 12));
    } catch { /* private mode */ }
    if (code || ref || qs.get('utm_source') || qs.get('fbclid')) history.replaceState(null, '', location.pathname);
    setReady(true);
  }, []);
  useEffect(() => { if (ready) save(K.events, manual); }, [manual, ready]);
  useEffect(() => { if (ready) save(K.ics, ics); }, [ics, ready]);
  useEffect(() => { if (ready) save(K.mail, mail.slice(-200)); }, [mail, ready]);
  useEffect(() => { if (ready) save(K.mailEdits, mailEdits); }, [mailEdits, ready]);
  useEffect(() => { if (ready) save(K.gcal, gcal); }, [gcal, ready]);
  async function refreshGcal(key = gcalKey) {
    if (!key) return false;
    const j = await fetch('/api/gcal/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!j) return false;
    if (!j.connected) { setGcal(null); return false; }
    setGcal({ email: j.email, events: j.events, at: new Date().toISOString() });
    return true;
  }
  // after Google sends the person back: read their calendar, open Settings, tidy the address bar
  useEffect(() => {
    if (!ready) return;
    const r = new URLSearchParams(location.search).get('gcal');
    if (r) { history.replaceState(null, '', location.pathname); setTab('settings'); setGcalNote(r); }
    if (gcalKey) refreshGcal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const [gcalNote, setGcalNote] = useState('');
  const loadBill = () => fetch('/api/billing/me').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setBill({ ...FREE_INFO, ...j }); }).catch(() => {});
  useEffect(() => {
    if (!ready || authed !== 'in') return;
    loadBill();
    const src = (() => { try { return localStorage.getItem(SRC_KEY); } catch { return null; } })();
    if (src) fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ src }) }).catch(() => {});
    const ref = (() => { try { return localStorage.getItem(REF_KEY); } catch { return null; } })();
    if (ref) fetch('/api/referral', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: ref }) })
      .catch(() => {}).finally(() => { try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ } });
    const promo = (() => { try { return localStorage.getItem(PROMO_KEY); } catch { return null; } })();
    if (promo) {
      fetch('/api/promo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: promo }) })
        .then((r) => r.json()).then((j) => { setTab('settings'); setBillNote(j.ok ? 'gift' : `gift_${j.error}`); loadBill(); })
        .catch(() => {}).finally(() => { try { localStorage.removeItem(PROMO_KEY); } catch { /* ignore */ } });
    }
    const r = new URLSearchParams(location.search).get('billing');
    if (r) { history.replaceState(null, '', location.pathname); setTab('settings'); setBillNote(r); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authed]);
  // Meta ads: report a trial start / paid subscription once per account and billing period.
  useEffect(() => {
    if (!account || !bill.status) return;
    const me = account.email || account.name || 'me';
    const paid = bill.plan === 'basic' || bill.plan === 'premium' ? PRICES[bill.plan][bill.interval ?? 'month'].cents / 100 : undefined;
    if (bill.status === 'trialing') trackMetaOnce(`fatecal.metaTrial:${me}`, 'StartTrial', { value: paid, currency: 'USD' });
    if (bill.status === 'active') trackMetaOnce(`fatecal.metaSub:${me}:${bill.periodEnd ?? ''}`, 'Subscribe', { value: paid, currency: 'USD' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill.status, bill.periodEnd, account]);
  async function upgrade(plan: 'basic' | 'premium' = 'basic', interval: Interval = 'month') {
    const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, interval, lang }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.url) { trackMeta('InitiateCheckout', { content_name: plan, value: PRICES[plan][interval].cents / 100, currency: 'USD' }); location.href = j.url; return; }
    if (r?.status === 409) { manage(); return; }
    setTab('settings'); setBillNote('unavailable');
  }
  async function manage() {
    const r = await fetch('/api/billing/portal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.url) location.href = j.url; else setBillNote('unavailable');
  }

  // Accounts: when signed in, the chart, events and settings are kept on the server and follow the user.
  useEffect(() => {
    if (!ready) return;
    if (!ACCOUNTS_ON) { synced.current = true; setAuthed('out'); return; }
    fetch('/api/auth/providers-list').then((r) => r.json()).then((j) => setProviders(j.providers ?? [])).catch(() => {});
    fetch('/api/sync').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j?.user) { synced.current = true; setAuthed('out'); return; }
      setAccount(j.user);
      // data left on this device by a different account is not shown to this one
      const me = j.user.email || j.user.name || 'me';
      const owner = load<string | null>(K.owner, null);
      if (owner && owner !== me) {
        [K.profile, K.events, K.ics, K.mailKey, K.mailAddr, K.mail].forEach((k) => localStorage.removeItem(k));
        setProfile(null); setManual([]); setIcs(null); setMail([]); setMailKey(null); setMailAddr(null);
      }
      save(K.owner, me);
      const d = j.data;
      // Meta ads: a just-completed sign-in whose account has no saved profile yet is a new registration.
      if (consumeRegistrationPending() && !d?.profile) trackMetaOnce(`fatecal.metaReg:${me}`, 'CompleteRegistration');
      if (d?.profile) {
        setProfile(d.profile); save(K.profile, d.profile);
        if (Array.isArray(d.events)) setManual(d.events);
        if (d.icsUrl && !ics?.url) setIcs({ url: d.icsUrl, events: [] });
        if ((d.langPick === 'en' || d.langPick === 'zh' || d.langPick === 'es') && !load<Lang | null>(K.langPick, null)) { setLangState(d.langPick); setLangPick(d.langPick); save(K.langPick, d.langPick); }
        if (d.mailKey && !mailKey) { save(K.mailKey, d.mailKey); setMailKey(d.mailKey); }
        if (d.gcalKey && !gcalKey) { save(K.gcalKey, d.gcalKey); setGcalKey(d.gcalKey); refreshGcal(d.gcalKey); }
      }
      synced.current = true;
      setAuthed('in');
    }).catch(() => { synced.current = true; setAuthed('out'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    if (!ready || !account || !synced.current || !profile) return;
    const id = setTimeout(() => {
      fetch('/api/sync', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), profile, events: manual, icsUrl: ics?.url ?? null, lang, langPick, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, mailKey, gcalKey }) }).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [ready, account, profile, manual, ics?.url, lang, langPick, mailKey, gcalKey]);

  // Fetch forwarded mail: on start, then every minute while the app is open.
  async function checkMail(key = mailKey, peek = false) {
    if (!key) return 0;
    const j = await fetch('/api/inbox', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, peek }) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!j) return -1;
    if (j.address) { setMailAddr(j.address); save(K.mailAddr, j.address); }
    if (j.usage) setMailUsage(j.usage);
    if (j.items?.length) setMail((m) => [...m, ...j.items.filter((x: MailItem) => !m.some((y) => y.id === x.id))]);
    return j.items?.length ?? 0;
  }
  // Events added from WhatsApp wait on the server; pick them up on start, every minute and when the app comes back.
  useEffect(() => {
    if (!ready || authed !== 'in') return;
    const pull = () => fetch('/api/pending').then((r) => (r.ok ? r.json() : null)).then((j) => {
      const evs: CalEvent[] = j?.events ?? [];
      if (evs.length) setManual((m) => [...m, ...evs.filter((e) => !m.some((x) => x.id === e.id))]);
    }).catch(() => {});
    pull();
    const id = setInterval(pull, 60000);
    const vis = () => { if (document.visibilityState === 'visible') pull(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [ready, authed]);
  useEffect(() => {
    if (!ready || !mailKey) return;
    checkMail();
    const id = setInterval(() => checkMail(), 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mailKey]);
  async function enableMail() {
    const key = crypto.randomUUID();
    save(K.mailKey, key);
    setMailKey(key);
    await checkMail(key, true);
  }

  // refresh the calendar feed once per session
  useEffect(() => {
    if (!ready || !ics?.url) return;
    fetch('/api/ics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: ics.url }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.events) setIcs({ url: ics.url, events: j.events, at: new Date().toISOString() }); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const chart = useMemo(() => (profile ? computeChart(profile.birth) : null), [profile]);
  const mailEvents = useMemo(() => (mail.map(mailToEvent).filter(Boolean) as CalEvent[])
    .filter((e) => mailEdits[e.id] !== null)
    .map((e) => (mailEdits[e.id] ? { ...e, ...mailEdits[e.id]! } : e)), [mail, mailEdits]);
  const manualExpanded = useMemo(() => {
    const now = new Date();
    return expandRepeats(manual, new Date(now.getFullYear(), now.getMonth() - 3, 1), new Date(now.getFullYear() + 1, now.getMonth() + 1, 1));
  }, [manual]);
  const events = useMemo(() => [...manualExpanded, ...(ics?.events ?? []), ...(gcal?.events ?? []), ...(phoneOn ? phoneEvents : []), ...mailEvents].sort((a, b) => a.start.localeCompare(b.start)), [manualExpanded, ics, gcal, mailEvents, phoneOn, phoneEvents]);
  useEffect(() => {
    if (!ready) return;
    setNative(isNativeApp());
    setPhoneOn(load<boolean>(K.phoneCal, false));
    setRem(load<NativeRem>(K.nativeRem, { on: false, before: 30, morning: true }));
  }, [ready]);
  // phone calendar: read on start and whenever the app comes back to the front
  useEffect(() => {
    if (!native || !phoneOn) return;
    const pull = async () => { if (await phoneCalendarAllowed(false)) setPhoneEvents(await phoneCalendarEvents().catch(() => [])); };
    pull();
    const vis = () => { if (document.visibilityState === 'visible') pull(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [native, phoneOn]);
  // local reminders: rebuilt whenever plans change (next 7 days), plus a morning reading
  useEffect(() => {
    if (!native) return;
    if (!rem.on || !chart) { setReminders([]); return; }
    const id = setTimeout(() => {
      const now = Date.now(), until = now + 7 * 86400000, list: Reminder[] = [];
      const t2 = T[lang];
      if (rem.before > 0) for (const e of events) {
        if (e.allDay) continue;
        const s = new Date(e.start).getTime();
        if (s < now || s > until) continue;
        const r = readEvent(chart, e, events);
        const alt = r.alternatives[0];
        let body = `${fmtTime(e.start, lang)} · ${r.score} ${t2[r.verdict]}`;
        if (r.verdict !== 'good' && alt && sameDay(new Date(alt.start), new Date(e.start))) body += ` · ${t2.qa.useBetter(fmtTime(alt.start, lang), alt.score)}`;
        list.push({ id: hashId(`${e.id}@${e.start}`), title: L3(lang, `In ${rem.before} min: ${e.title}`, `${rem.before} 分钟后：${e.title}`, `En ${rem.before} min: ${e.title}`), body, at: new Date(s - rem.before * 60000) });
      }
      if (rem.morning) for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i); d.setHours(8, 0, 0, 0);
        const sc = scoreDay(chart, d), best = sc.bestHours[0];
        list.push({ id: hashId(`am:${dateKey(d)}`), title: L3(lang, `Today: ${sc.score} · ${t2[sc.verdict]}`, `今天 ${sc.score} 分 · ${t2[sc.verdict]}`, `Hoy: ${sc.score} · ${t2[sc.verdict]}`),
          body: `${t2.verdictLine[sc.verdict].replace('{w}', L3(lang, 'Today', '今天', 'Hoy'))}${best ? ` ${t2.v2.window(fmtHour(best.start, lang), fmtHour(best.start + 2, lang), L3(lang, 'today', '今天', 'hoy'))}` : ''}`, at: d });
      }
      setReminders(list);
    }, 1500);
    return () => clearTimeout(id);
  }, [native, rem, events, chart, lang]);
  // move or remove any event the user owns in FateCal: ones they added, and ones that came from email
  const moveEvent = (e: CalEvent, start: string, end: string) => {
    // one occurrence of a repeating series: skip that date in the series and add a one-off at the new time
    if (e.source === 'manual' && e.seriesId) {
      const key = dateKey(new Date(e.start));
      setManual([...manual.map((m) => (m.id === e.seriesId ? { ...m, exdates: [...(m.exdates ?? []), key] } : m)),
        { ...e, id: `m${Date.now()}`, seriesId: undefined, repeat: undefined, start, end }]);
      return;
    }
    if (e.source === 'manual') setManual(manual.map((m) => (m.id === e.id ? { ...m, start, end } : m)));
    else if (e.source === 'email') setMailEdits({ ...mailEdits, [e.id]: { start, end } });
  };
  const removeEvent = (e: CalEvent, all = false) => {
    if (e.source === 'manual' && e.seriesId) {
      if (all) setManual(manual.filter((m) => m.id !== e.seriesId));
      else setManual(manual.map((m) => (m.id === e.seriesId ? { ...m, exdates: [...(m.exdates ?? []), dateKey(new Date(e.start))] } : m)));
      return;
    }
    if (e.source === 'manual') setManual(manual.filter((m) => m.id !== e.id));
    else if (e.source === 'email') setMailEdits({ ...mailEdits, [e.id]: null });
  };
  const t = T[lang];

  // Before local data loads (and on the server) show the onboarding screen, so the page has real content for search engines.
  // Everyone signs up first (Google, Facebook, email or phone), then fills in their birth details.
  if (!ready) return <div className="preload"><Landing lang={lang} setLang={setLang} providers={[]} onDone={() => {}} /></div>;
  if (!ACCOUNTS_ON && (!profile || !chart)) return <Landing lang={lang} setLang={setLang} providers={[]} onDone={(p) => { setProfile(p); save(K.profile, p); }} />;
  if (ACCOUNTS_ON && authed === 'checking') return <div className="shell onboard"><div className="hero"><Logo big lang={lang} /><p className="muted" aria-live="polite">{t.loading}</p></div></div>;
  if (ACCOUNTS_ON && authed === 'out') return <Landing lang={lang} setLang={setLang} providers={providers} onDone={() => {}} />;
  if (!profile || !chart) {
    return <Onboarding lang={lang} setLang={setLang} initial={null} account={account} onDone={(p) => { setProfile(p); save(K.profile, p); }} />;
  }

  const v2 = t.v2;
  return (
    <Bill.Provider value={{ info: bill, upgrade, manage, refresh: loadBill }}>
    <div className="desk">
    <aside className="desk-side">
      <Logo big lang={lang} />
      <h1>{v2.deskH1a} <em>{v2.deskEm}</em> {v2.deskH1b}</h1>
      <p className="lead">{v2.deskLead}</p>
      <ul>{v2.deskPts.map(([em, h, p]) => <li key={h}>{em} <b>{h}</b>: {p}</li>)}</ul>
      <Footer lang={lang} />
    </aside>
    <div className="shell">
      <header className="top">
        <Logo lang={lang} />
        <LangMenu lang={lang} setLang={setLang} />
      </header>
      <main className="main">
        {tab === 'today' && <Today lang={lang} chart={chart} events={events} manual={manual} setManual={setManual} name={profile.name} onMove={moveEvent} onRemove={removeEvent} />}
        {tab === 'ask' && <Ask lang={lang} chart={chart} events={events} profile={profile} seed={seed} clearSeed={() => setSeed(null)} />}
        {tab === 'home' && <FengShui lang={lang} chart={chart} profile={profile} setSex={(sx) => { const p = { ...profile, sex: sx }; setProfile(p); save(K.profile, p); }} ask={(sd) => { setSeed(sd); setTab('ask'); }} />}
        {tab === 'chart' && <ChartView lang={lang} chart={chart} profile={profile} onEdit={(p) => { setProfile(p); save(K.profile, p); }} />}
        {tab === 'settings' && (
          <Settings lang={lang} setLang={setLang} ics={ics} setIcs={setIcs} billNote={billNote}
            nativeApp={native ? { phoneOn, phoneCount: phoneEvents.length, setPhoneOn: (v: boolean) => { setPhoneOn(v); save(K.phoneCal, v); if (!v) setPhoneEvents([]); }, rem, setRem: (r: NativeRem) => { setRem(r); save(K.nativeRem, r); } } : null}
            gcal={gcal} gcalNote={gcalNote}
            onGcalConnect={() => { let k = gcalKey; if (!k) { k = crypto.randomUUID(); save(K.gcalKey, k); setGcalKey(k); } location.href = `/api/gcal/start?key=${encodeURIComponent(k)}`; }}
            onGcalRefresh={() => refreshGcal()}
            onGcalDisconnect={async () => { if (gcalKey) await fetch('/api/gcal/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: gcalKey }) }).catch(() => {}); setGcal(null); setGcalNote(''); }} chart={chart} account={account} providers={providers}
            mail={mail} mailAddr={mailAddr} mailUsage={mailUsage} onEnableMail={enableMail} onCheckMail={() => checkMail()} onClearMail={() => setMail([])}
            onReset={() => { if (confirm(t.resetConfirm)) { Object.values(K).filter((k) => k !== K.langPick).forEach((k) => localStorage.removeItem(k)); location.reload(); } }} />
        )}
      </main>
      <nav className="tabs">
        {(['today', 'ask', 'home', 'chart', 'settings'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} aria-label={t[k]}>
            <Icon name={k} />
            <span>{t[k]}</span>
          </button>
        ))}
      </nav>
    </div>
    </div>
    </Bill.Provider>
  );
}

// ---------------- onboarding ----------------

function Onboarding({ lang, setLang, initial, onDone, onCancel, account = null, embedded = false }: { lang: Lang; setLang: (l: Lang) => void; initial: Profile | null; onDone: (p: Profile) => void; onCancel?: () => void; account?: Account | null; embedded?: boolean }) {
  const t = T[lang];
  const b = initial?.birth;
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(b ? `${b.year}-${pad(b.month)}-${pad(b.day)}` : '');
  const [time, setTime] = useState(b && !b.hourUnknown ? `${pad(b.hour)}:${pad(b.minute)}` : '');
  const [unknown, setUnknown] = useState(!!b?.hourUnknown);
  const [place, setPlace] = useState(initial?.place ?? '');
  const [sex, setSex] = useState<Sex | undefined>(initial?.sex);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && (unknown || /^\d{2}:\d{2}$/.test(time));

  const form = () => (
      <form className="card form" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const [y, m, d] = date.split('-').map(Number);
        const [hh, mm] = unknown ? [12, 0] : time.split(':').map(Number);
        onDone({ name: name.trim(), place: place.trim(), sex, birth: { year: y, month: m, day: d, hour: hh, minute: mm, hourUnknown: unknown } });
      }}>
        <label>{t.name}<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        <label>{t.birthDate}<input type="date" required value={date} min="1900-01-01" max="2100-12-31" onChange={(e) => setDate(e.target.value)} /></label>
        <label>{t.birthTime}<input type="time" value={time} disabled={unknown} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />{t.timeUnknown}</label>
        <div className="field">
          <span>{t.fs.sexLabel}</span>
          <div className="seg">
            <button type="button" className={sex === 'm' ? 'on' : ''} onClick={() => setSex('m')}>{t.fs.male}</button>
            <button type="button" className={sex === 'f' ? 'on' : ''} onClick={() => setSex('f')}>{t.fs.female}</button>
          </div>
        </div>
        <label>{t.birthPlace}<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Shanghai / Los Angeles" /></label>
        <p className="muted small">{t.birthPlaceHint} {t.privacyShort}</p>
        <button className="primary" disabled={!valid}>{initial ? t.save : t.continue}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>{t.cancel}</button>}
      </form>
  );
  if (embedded) return <>{form()}</>;
  return (
    <div className="shell onboard">
      {!initial && <header className="top"><span /><LangMenu lang={lang} setLang={setLang} /></header>}
      {!initial && (
        <div className="hero">
          <Logo big lang={lang} />
          <h1>{t.welcome}{account?.name && !account.name.includes('@') && !account.name.includes('*') ? `, ${account.name}` : ''}</h1>
          <p className="muted">{t.profileIntro}</p>
        </div>
      )}
      {form()}
      <p className="muted small pad">{t.simplified}</p>
      {!initial && <Footer lang={lang} />}
    </div>
  );
}

// ---------------- landing and sign-up ----------------

// Chinese brand name: 随身吉历 (shown next to the FateCal logo in Chinese)
export const ZH_NAME = '随身吉历';
function Logo({ big = false, lang }: { big?: boolean; lang?: Lang }) {
  return (
    <span className={`logowrap ${big ? 'big' : ''}`}>
      <img className={big ? 'logo big' : 'logo'} src="/logo.svg" alt={lang === 'zh' ? `${ZH_NAME} FateCal` : 'FateCal'} width={big ? 187 : 130} height={big ? 46 : 32} />
      {lang === 'zh' && <span className="zhname">{ZH_NAME}</span>}
    </span>
  );
}

// Language picker, top right on every screen: 🌐 + the current language + ▾ (native menu, so it works well on phones)
const LANGS: { id: Lang; name: string }[] = [{ id: 'en', name: 'English' }, { id: 'zh', name: '中文' }, { id: 'es', name: 'Español' }];
function LangMenu({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <label className="langpick">
      <span aria-hidden="true">🌐</span>
      <span className="langname">{LANGS.find((x) => x.id === lang)?.name}</span>
      <span aria-hidden="true" className="caret">▾</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language / 语言 / Idioma">
        {LANGS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  );
}

function Landing({ lang, setLang, providers, onDone }: { lang: Lang; setLang: (l: Lang) => void; providers: string[]; onDone: (p: Profile) => void }) {
  const t = T[lang];
  const l = t.lp;
  const [moved, setMoved] = useState(false);
  const [why, setWhy] = useState(false);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="shell onboard">
      <header className="top">
        <Logo lang={lang} />
        <LangMenu lang={lang} setLang={setLang} />
      </header>
      <PromoBanner lang={lang} />
      <div className="hero">
        <div className="eyebrow">{l.eyebrow}</div>
        <h1 className="display">{l.h1a}<br /><span>{l.h1b}</span></h1>
        <p className="lead">{l.sub}</p>
        <div className="row gap wrap">
          <button className="primary" onClick={() => go('start')}>{l.start}</button>
          <button className="ghost" onClick={() => go('demo')}>{l.tryIt}</button>
        </div>
        <p className="tiny">{l.tryNote}</p>
      </div>
      {/* sign-up right under the headline, so Google / email / phone are visible without scrolling far */}
      {ACCOUNTS_ON && <div id="start"><SignUp lang={lang} providers={providers} /></div>}

      <section id="demo" className="demo" aria-label={l.demoLabel}>
        <div className="tiny demo-k">{l.demoLabel}</div>
        <div className="demo-card">
          <div className="row between"><b>{l.week}</b></div>
          <div className="wk">
            {l.days.map((d, i) => <span key={d} className={(!moved && i === 1) || (moved && i === 3) ? 'on' : ''}>{d}</span>)}
          </div>
          <div className="row between top-align demo-ev">
            <div>
              <div className="tiny">{moved ? l.recTime : l.evTime}</div>
              <div className="ev-title">{l.evTitle}</div>
            </div>
            <span className={`tag ${moved ? 'good' : 'bad'}`}>{moved ? t.good : l.evBad}</span>
          </div>
          {!moved ? (
            <>
              <div className="rec row between"><div><div className="tiny">{l.recLabel}</div><b>{l.recTime}</b></div><b>76</b></div>
              <div className="row gap">
                <button className="primary" onClick={() => { setMoved(true); setWhy(false); }}>{l.moveBtn}</button>
                <button className="link" onClick={() => setWhy(!why)} aria-expanded={why}>{l.why}</button>
              </div>
            </>
          ) : (
            <div className="row gap"><span className="small grow" aria-live="polite">{l.moved}</span><button className="link" onClick={() => setMoved(false)}>{l.undo}</button></div>
          )}
          {why && !moved && <p className="small muted">{l.whyText}</p>}
        </div>
      </section>

      <section className="feats">
        {([[l.f1k, l.f1h, l.f1p], [l.f2k, l.f2h, l.f2p], [l.f3k, l.f3h, l.f3p]] as string[][]).map(([k, h, p]) => (
          <div key={k}><div className="eyebrow sm">{k}</div><h3>{h}</h3><p className="small muted">{p}</p></div>
        ))}
      </section>

      <section className="feats more">
        <div className="eyebrow sm">{l.moreH}</div>
        {l.more.map(([h, p]) => <div key={h}><h3>{h}</h3><p className="small muted">{p}</p></div>)}
      </section>

      <section className="faq">
        <div className="eyebrow">{l.faqK}</div>
        <h2 className="display sm">{l.faqH1}<br />{l.faqH2}</h2>
        {l.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="small muted">{a}</p></details>)}
      </section>

      {ACCOUNTS_ON ? (
        <section className="startform stack">
          <h2 className="display sm">{l.formH}</h2>
          <button className="primary" onClick={() => go('start')}>{t.signUp} ↑</button>
        </section>
      ) : (
        <>
          <section id="start" className="startform">
            <h2 className="display sm">{l.formH}</h2>
            <p className="small muted">{l.formP}</p>
          </section>
          <Onboarding lang={lang} setLang={setLang} initial={null} onDone={onDone} embedded />
        </>
      )}
      <p className="muted small pad">{t.simplified}</p>
      <Footer lang={lang} />
    </div>
  );
}

const DIAL = ['+1', '+86', '+852', '+853', '+886', '+65', '+60', '+81', '+82', '+44', '+61', '+64', '+33', '+49', '+52'];

// Catch common email typos before sending a code: hotmail.con → hotmail.com, gmial.com → gmail.com, qq.cm → qq.com
const MAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'qq.com', '163.com', '126.com', 'live.com', 'msn.com', 'aol.com', 'me.com', 'sina.com', 'foxmail.com'];
function emailTypo(email: string): string | null {
  const m = email.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!m) return null;
  const [, user, dom] = m;
  if (MAIL_DOMAINS.includes(dom)) return null;
  const dist = (a: string, b: string) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  let best: string | null = null, bd = 3;
  for (const c of MAIL_DOMAINS) { const x = dist(dom, c); if (x < bd) { bd = x; best = c; } }
  if (best) return `${user}@${best}`;
  // any domain ending in a mistyped .com (.con, .cmo, .co m)
  const fixed = dom.replace(/\.(con|cmo|ocm|vom|xom|cm|om|comm|coom)$/, '.com');
  return fixed !== dom ? `${user}@${fixed}` : null;
}

function SignUp({ lang, providers }: { lang: Lang; providers: string[] }) {
  const t = T[lang];
  const [mode, setMode] = useState<'pick' | 'email' | 'phone'>('pick');
  const [step, setStep] = useState<'enter' | 'code'>('enter');
  const [email, setEmail] = useState('');
  const [dial, setDial] = useState(lang === 'zh' ? '+86' : lang === 'es' ? '+52' : '+1');
  const [num, setNum] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [typo, setTypo] = useState<string | null>(null);
  const [typoAsked, setTypoAsked] = useState(false);
  const to = mode === 'email' ? email.trim() : `${dial}${num.replace(/[^\d]/g, '').replace(/^0+/, '')}`;
  const social = isNativeApp() ? [] : providers.filter((p) => p === 'google' || p === 'facebook');

  async function send() {
    setErr('');
    if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setErr(t.badEmail); return; }
    if (mode === 'email' && step === 'enter' && !typoAsked) {
      const fix = emailTypo(email);
      if (fix) { setTypo(fix); setTypoAsked(true); return; }
    }
    if (mode === 'phone' && !/^\+[1-9]\d{6,14}$/.test(to)) { setErr(t.badPhone); return; }
    setBusy(true);
    const res = await fetch('/api/auth/otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: mode, to, lang }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) { setStep('code'); setCode(''); return; }
    if (res?.status === 429) { setErr(t.waitResend); if (step === 'enter') setStep('code'); return; }
    setErr(res?.status === 400 ? (mode === 'email' ? t.badEmail : t.badPhone) : t.sendFailed);
  }
  async function verify() {
    setErr('');
    setBusy(true);
    const r = await signIn('otp', { channel: mode, to, code: code.trim(), redirect: false }).catch(() => null);
    if (!r || r.error) { setBusy(false); setErr(t.badCode); return; }
    markRegistrationPending();
    location.href = '/';
  }

  return (
    <section className="card stack" aria-labelledby="signup-h">
      <div>
        <h2 id="signup-h">{t.signUp}</h2>
        <p className="small muted">{t.signUpIntro}</p>
      </div>
      {mode === 'pick' && (
        <>
          {social.map((p) => (
            <button key={p} className="social" onClick={() => { markRegistrationPending(); signIn(p, { redirectTo: '/' }); }}>
              <ProviderIcon id={p} /> {p === 'google' ? t.withGoogle : t.withFacebook}
            </button>
          ))}
          {providers.includes('email') && <button className="social" onClick={() => { setMode('email'); setStep('enter'); setErr(''); }}><MailIcon /> {t.withEmail}</button>}
          {providers.includes('phone') && <button className="social" onClick={() => { setMode('phone'); setStep('enter'); setErr(''); }}><PhoneIcon /> {t.withPhone}</button>}
        </>
      )}
      {mode !== 'pick' && step === 'enter' && (
        <form className="form flat" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {mode === 'email' ? (
            <>
            <label>{t.emailLabel}<input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setTypo(null); setTypoAsked(false); }} autoComplete="email" inputMode="email" required autoFocus /></label>
            {typo && (
              <div className="suggest small" role="alert">
                {t.didYouMean} <b>{typo}</b>?{' '}
                <button type="button" className="link" onClick={() => { setEmail(typo); setTypo(null); setTypoAsked(false); }}>{t.useThis}</button>
              </div>
            )}
            </>
          ) : (
            <div className="row gap">
              <label className="dial">{t.country}<select value={dial} onChange={(e) => setDial(e.target.value)}>{DIAL.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
              <label className="grow">{t.phoneLabel}<input type="tel" value={num} onChange={(e) => setNum(e.target.value)} autoComplete="tel-national" inputMode="tel" required autoFocus /></label>
            </div>
          )}
          {mode === 'phone' && <p className="tiny muted">{t.smsNote}</p>}
          <button className="primary" disabled={busy}>{busy ? t.sending : t.sendCode}</button>
          <button type="button" className="ghost" onClick={() => { setMode('pick'); setErr(''); }}>{t.back}</button>
        </form>
      )}
      {mode !== 'pick' && step === 'code' && (
        <form className="form flat" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <p className="small">{t.codeSentTo} <b>{to}</b></p>
          <label>{t.codeLabel}<input value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" required autoFocus /></label>
          <button className="primary" disabled={busy || code.length < 4}>{busy ? t.verifying : t.verify}</button>
          <div className="row gap">
            <button type="button" className="link" disabled={busy} onClick={send}>{t.resend}</button>
            <button type="button" className="link" onClick={() => { setStep('enter'); setErr(''); }}>{t.changeTo}</button>
          </div>
        </form>
      )}
      {err && <p className="danger small" role="alert">{err}</p>}
      <p className="tiny muted">{t.agree} <a href="/terms">{L3(lang, 'Terms', '服务条款', 'Términos')}</a> {t.and} <a href="/privacy">{L3(lang, 'Privacy Policy', '隐私政策', 'Política de privacidad')}</a>.</p>
    </section>
  );
}

function MailIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>;
}
function PhoneIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18h3" /></svg>;
}

// ---------------- today ----------------

function VerdictTag({ v, lang }: { v: 'good' | 'neutral' | 'bad'; lang: Lang }) {
  return <span className={`tag ${v}`}>{T[lang][v]}</span>;
}

const CAT_EMOJI: Partial<Record<Category, string>> = { meeting: '🤝', signing: '✍️', travel: '✈️', opening: '🚀', money: '💸', moving: '🏠', romance: '💞', medical: '🩺', haircut: '✂️', study: '📚', build: '🛠️', wedding: '💍', cleaning: '🧹' };
const shortHour = (h: number, lang: Lang) => (lang === 'zh' ? `${h % 24}点` : lang === 'es' ? `${h % 24}h` : `${((h + 11) % 12) + 1}${h % 24 < 12 ? 'a' : 'p'}`);

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <div className="scorering" role="img" aria-label={`${label} ${score}`}>
      <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="9" />
        <circle cx="52" cy="52" r={r} fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} />
      </svg>
      <div className="v"><b>{score}</b><span>{label}</span></div>
    </div>
  );
}

function Today({ lang, chart, events, manual, setManual, name, onMove, onRemove }: { lang: Lang; chart: Chart; events: CalEvent[]; manual: CalEvent[]; setManual: (e: CalEvent[]) => void; name: string; onMove: (e: CalEvent, s: string, en: string) => void; onRemove: (e: CalEvent, all?: boolean) => void }) {
  const t = T[lang];
  const v = t.v2;
  const limits = useBill().info.limits;
  const [day, setDay] = useState(() => new Date());
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const summary = useMemo(() => scoreDay(chart, day), [chart, day]);
  const acts = useMemo(() => dayActivities(chart, day), [chart, day]);
  const [trad, setTrad] = useState(false);
  const sep = lang === 'zh' ? '、' : ', ';
  const todays = events.filter((e) => sameDay(new Date(e.start), day)).sort((a, b) => a.start.localeCompare(b.start));
  const [slide, setSlide] = useState<'' | 'l' | 'r'>('');
  const shift = (n: number) => { setSlide(n > 0 ? 'l' : 'r'); setDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + n)); };
  const isToday = sameDay(day, new Date());
  // swipe left = next day, swipe right = previous day
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s0 = touch.current; touch.current = null; if (!s0) return;
    const p = e.changedTouches[0], dx = p.clientX - s0.x, dy = p.clientY - s0.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
  };
  // if you were looking at today and the date rolls over (app left open overnight), follow to the new today
  const shownToday = useRef(isToday);
  shownToday.current = isToday;
  useEffect(() => {
    let last = new Date();
    const check = () => { const now = new Date(); if (!sameDay(now, last)) { if (sameDay(day, last) || shownToday.current) setDay(now); last = now; } };
    const vis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', vis);
    const id = setInterval(check, 60000);
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(id); };
  }, [day]);
  const rel = relDay(day, lang);
  const hr = new Date().getHours();
  const hi = v.hi[hr < 12 ? 0 : hr < 18 ? 1 : 2];
  const gz = summary.ganZhi;
  const gzName = lang === 'zh' ? `${ELEMENT_NAME[STEM[gz[0]].el].zh}${BRANCH[gz[1]].zh}日` : lang === 'es' ? `Día ${ANIMAL_ES[BRANCH[gz[1]].animal]} de ${ELEMENT_NAME[STEM[gz[0]].el].es} · ${STEM[gz[0]].pinyin}-${BRANCH[gz[1]].pinyin}` : `${ELEMENT_NAME[STEM[gz[0]].el].en} ${BRANCH[gz[1]].animal} day · ${STEM[gz[0]].pinyin}-${BRANCH[gz[1]].pinyin}`;
  const dateStr = day.toLocaleDateString(tLocale(lang), { month: lang === 'zh' ? 'long' : 'short', day: 'numeric' });
  const best = summary.bestHours[0];
  const hs = summary.hours.map((h) => h.score);
  const lo = Math.min(...hs), hiS = Math.max(...hs);
  const top2 = [...summary.hours].sort((a, b) => b.score - a.score).slice(0, 2).map((h) => h.start);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  return (
    <div className="stack">
      <div className="greet">{hi}{name ? (lang === 'zh' ? `，${name}` : `, ${name}`) : ''} 👋</div>
      <QuickAdd lang={lang} chart={chart} events={events} onAdd={(evs) => { setManual([...manual, ...evs]); const d = new Date(evs[0].start); if (!sameDay(d, day)) setDay(d); }} />
      <div className="swipeday" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="daynav">
        <button className="icon" onClick={() => shift(-1)} aria-label={t.prevDay}>‹</button>
        <div className="dayhead">
          <h1>{rel.label ? `${rel.label} · ${dateStr}` : fmtDay(day, lang)}</h1>
          <div className="gzline"><span className="han">{gz}</span>{gzName}</div>
        </div>
        <button className="icon" onClick={() => shift(1)} aria-label={t.nextDay}>›</button>
      </div>

      <section key={day.toDateString()} className={`herocard${slide ? ` slide-${slide}` : ''}`}>
        <ScoreRing score={summary.score} label={v.scoreOf(rel.word)} />
        <div className="grow">
          <span className={`vpill ${summary.verdict}`}><i />{t[summary.verdict]}</span>
          <h2>{t.verdictLine[summary.verdict].replace('{w}', rel.word)}</h2>
          {best && <p>{v.window(fmtHour(best.start, lang), fmtHour(best.start + 2, lang), rel.word)}</p>}
          <button className="link light" onClick={() => setTrad(!trad)} aria-expanded={trad}>{trad ? t.hideAlmanac : t.showAlmanac}</button>
          {trad && (
            <div className="trad">
              <p><b>{L3(lang, 'Almanac yi', '宜', 'Almanaque: sí')}:</b> {summary.yi.map((w) => almanac(w, lang)).join(sep)}</p>
              <p><b>{L3(lang, 'Almanac ji', '忌', 'Almanaque: no')}:</b> {summary.ji.map((w) => almanac(w, lang)).join(sep)}</p>
            </div>
          )}
        </div>
      </section>

      <div className="gfav">
        <section className="card good">
          <div className="k"><i />{t.goodFor}</div>
          <div className="chips">
            {acts.good.length ? acts.good.slice(0, 5).map((a) => <span key={a.cat} className="chip good">{CAT_EMOJI[a.cat]} {activityName(a.cat, lang)}</span>) : <span className="chip none">{t.routineOnly}</span>}
          </div>
        </section>
        <section className="card avoid">
          <div className="k"><i />{t.avoid}</div>
          <div className="chips">
            {acts.avoid.length ? acts.avoid.slice(0, 5).map((a) => <span key={a.cat} className="chip avoid">{CAT_EMOJI[a.cat]} {activityName(a.cat, lang)}</span>) : <span className="chip none">{t.nothingMajor}</span>}
          </div>
        </section>
      </div>
      </div>

      <div className="sechead"><h3>{t.bestHours}</h3><span className="small muted">{v.hoursSub}</span></div>
      <section className="card">
        <div className="hours" role="list">
          {summary.hours.map((h) => {
            const isTop = top2.includes(h.start);
            const pct = 22 + (hiS === lo ? 50 : ((h.score - lo) / (hiS - lo)) * 78);
            return (
              <div key={h.start} className="col" role="listitem" aria-label={`${fmtHour(h.start, lang)}–${fmtHour(h.start + 2, lang)}: ${h.score}`}>
                <span className="val">{isTop ? h.score : ''}</span>
                <span className={`bar2 ${isTop ? 'top' : h.score >= 60 ? 'mid' : ''}`} style={{ height: `${pct}%` }} />
                <span className="lab">{shortHour(h.start, lang)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {summary.reasons.length > 0 && (
        <section className="card">
          <div className="label">{v.whyToday(rel.word)}</div>
          <ul className="whyday">
            {summary.reasons.map((r, i) => <li key={i}><span className={`em ${r.delta >= 0 ? 'p' : 'm'}`}>{r.delta >= 0 ? '↑' : '↓'}</span><span>{reasonText(r, lang)}</span></li>)}
          </ul>
        </section>
      )}

      <MonthCal lang={lang} chart={chart} events={events} day={day} setDay={setDay} />

      <div className="sechead">
        <h3>{t.schedule}</h3>
        <button className="link" onClick={() => setAdding(true)}>+ {t.addEvent}</button>
      </div>
      {todays.length === 0 && <p className="muted small">{t.noEvents}</p>}
      {todays.map((e) => (
        <EventCard key={e.id} lang={lang} chart={chart} ev={e} all={events}
          onMove={(s, en) => { onMove(e, s, en); flash(v.movedToast); }}
          onDelete={() => { if (e.seriesId) { onRemove(e, confirm(t.qa.delSeries)); return; } if (e.source !== 'email' || confirm(t.v2.removeMailConfirm)) onRemove(e); }} />
      ))}
      <button className="addbig" onClick={() => setAdding(true)}>+ {v.addOrConnect}</button>
      {adding && <AddEvent lang={lang} day={day} onSave={(e) => {
        const sameDate = manual.filter((m) => sameDay(new Date(m.start), new Date(e.start))).length;
        if (sameDate >= limits.manualPerDay) { setAdding(false); flash(t.bill.addLimit(limits.manualPerDay)); return; }
        setManual([...manual, e]); setAdding(false);
      }} onCancel={() => setAdding(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {SHOPPING_ON && <ShoppingResources lang={lang} />}
    </div>
  );
}

// Month view: each date shows its overall reading, and a mark when something is scheduled.
function MonthCal({ lang, chart, events, day, setDay }: { lang: Lang; chart: Chart; events: CalEvent[]; day: Date; setDay: (d: Date) => void }) {
  const t = T[lang];
  const [open, setOpen] = useState(true);
  const y = day.getFullYear(), m = day.getMonth();
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const verdicts = useMemo(() => Array.from({ length: days }, (_, i) => scoreDay(chart, new Date(y, m, i + 1)).verdict), [chart, y, m, days]);
  const counts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const e of events) { const d = new Date(e.start); if (d.getFullYear() === y && d.getMonth() === m) c[d.getDate()] = (c[d.getDate()] ?? 0) + 1; }
    return c;
  }, [events, y, m]);
  const today = new Date();
  const week = L3(lang, ['S', 'M', 'T', 'W', 'T', 'F', 'S'], ['日', '一', '二', '三', '四', '五', '六'], ['D', 'L', 'M', 'X', 'J', 'V', 'S']);
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const title = first.toLocaleDateString(tLocale(lang), { year: 'numeric', month: 'long' });
  return (
    <section className="card month">
      <div className="row between">
        <button className="icon sm" onClick={() => setDay(new Date(y, m - 1, 1))} aria-label={t.prevMonth}>‹</button>
        <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>{title} {open ? '▴' : '▾'}</button>
        <button className="icon sm" onClick={() => setDay(new Date(y, m + 1, 1))} aria-label={t.nextMonth}>›</button>
      </div>
      {open && (
        <>
          <div className="mgrid" role="grid">
            {week.map((w, i) => <div key={`w${i}`} className="wd" aria-hidden="true">{w}</div>)}
            {cells.map((d, i) => d === null ? <div key={`e${i}`} /> : (
              <button key={d} role="gridcell"
                className={`md ${verdicts[d - 1]} ${d === day.getDate() ? 'sel' : ''} ${sameDay(new Date(y, m, d), today) ? 'today' : ''}`}
                onClick={() => setDay(new Date(y, m, d))}
                aria-label={`${new Date(y, m, d).toLocaleDateString(tLocale(lang), { month: 'long', day: 'numeric' })}, ${t[verdicts[d - 1]]}${counts[d] ? `, ${counts[d]} ${t.eventsWord}` : ''}`}>
                <span className="n">{d}</span>
                {counts[d] ? <span className="ev">{counts[d]}</span> : <span className="ev none" />}
              </button>
            ))}
          </div>
          <div className="legend small muted">
            <span><i className="lg good" />{t.good}</span><span><i className="lg neutral" />{t.neutral}</span><span><i className="lg bad" />{t.bad}</span><span><i className="lg ev" />{t.hasEvents}</span>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------- quick add: one sentence (typed or spoken) → events ----------------

type Draft = CalEvent & { assumed?: string; orig?: { start: string; end: string } };

function repeatText(r: CalEvent['repeat'], lang: Lang) {
  if (!r) return '';
  const q = T[lang].qa;
  const days = r.freq === 'weekly' && r.byDay?.length ? ` · ${r.byDay.map((d) => q.days[d]).join(lang === 'zh' ? '、' : ', ')}` : '';
  return `🔁 ${q.rep[r.freq]}${days}${r.until ? ` · ${q.until} ${r.until}` : ''}`;
}

// How a date reads next to today: 今天/明天/后天/昨天/前天, then 本周X / 下周X / 上周X (weeks start Monday), else none.
// `word` is what the day is called inside sentences ("明天最顺的时段", "Why tomorrow feels this way").
function relDay(day: Date, lang: Lang): { label: string; word: string } {
  const r = T[lang].v2.rel;
  const mid = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const diff = Math.round((mid(day) - mid(now)) / 86400000);
  const byDiff: Record<number, string> = { 0: r.today, 1: r.tomorrow, 2: r.after, [-1]: r.yesterday, [-2]: r.before };
  let label = byDiff[diff] ?? '';
  if (!label) {
    const monday = (d: Date) => mid(d) - ((d.getDay() + 6) % 7) * 86400000;
    const weeks = Math.round((monday(day) - monday(now)) / (7 * 86400000));
    const wd = lang === 'zh' ? `周${'日一二三四五六'[day.getDay()]}` : day.toLocaleDateString(tLocale(lang), { weekday: 'long' });
    label = weeks === 0 ? r.thisW(wd) : weeks === 1 ? r.nextW(wd) : weeks === -1 ? r.lastW(wd) : '';
  }
  const word = label ? r.word(label) : L3(lang, 'this day', '这天', 'este día');
  return { label, word };
}

// iOS keyboard dictation can put the words back after the box is cleared; end it and clear twice
function clearAfterSend(sent: string, set: (f: (cur: string) => string) => void) {
  (document.activeElement as HTMLElement | null)?.blur?.();
  set(() => '');
  const norm = (x: string) => x.replace(/\s+/g, '');
  const s0 = norm(sent);
  for (const ms of [250, 700, 1500]) setTimeout(() => set((cur) => (cur && (s0.includes(norm(cur)) || norm(cur).includes(s0)) ? '' : cur)), ms);
}

function alertUpdate(lang: Lang) {
  window.alert(L3(lang, 'Photos need the latest app version. Update FateCal in TestFlight, then try again.', '拍照功能需要最新版 App。请在 TestFlight 里更新随身吉历后再试。', 'Las fotos necesitan la última versión. Actualiza FateCal en TestFlight y vuelve a intentarlo.'));
}

// Text box that grows taller with what you type (width stays the same); Enter sends, Shift+Enter adds a line
const GrowBox = forwardRef<HTMLTextAreaElement, { value: string; onChange: (v: string) => void; onEnter: () => void; placeholder?: string; ariaLabel?: string; id?: string; maxLength?: number }>(
  function GrowBox({ value, onChange, onEnter, placeholder, ariaLabel, id, maxLength }, ref) {
    const inner = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
    useLayoutEffect(() => {
      const el = inner.current; if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight + 2, 160)}px`;
      el.style.overflowY = el.scrollHeight > 158 ? 'auto' : 'hidden';
    }, [value]);
    return (
      <textarea ref={inner} id={id} className="growbox" rows={1} value={value} maxLength={maxLength} placeholder={placeholder} aria-label={ariaLabel ?? placeholder}
        enterKeyHint="send" onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); onEnter(); } }} />
    );
  });

function QuickAdd({ lang, chart, events, onAdd }: { lang: Lang; chart: Chart; events: CalEvent[]; onAdd: (evs: CalEvent[]) => void }) {
  const q = T[lang].qa;
  const t = T[lang];
  const { upgrade } = useBill();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [msg, setMsg] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const recRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function send(said = text) {
    if (!said.trim() || busy) return;
    (document.activeElement as HTMLElement | null)?.blur?.(); // ends keyboard dictation
    setBusy(true); setMsg(''); setLimitHit(false);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const r = await fetch('/api/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: said, tz, lang }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (r?.status === 429) { setMsg(q.limit(j?.limit ?? 5)); setLimitHit(true); return; }
    if (!r?.ok || !j) { setMsg(q.failed); return; }
    if (!j.events?.length) { setMsg(j.question || q.none); return; }
    setDrafts(j.events.map((e: any, i: number) => ({ ...e, id: `q${Date.now()}${i}`, source: 'manual', via: 'ai' })));
  }

  function mic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // In the phone app the web speech API doesn't work: open the keyboard so its own 🎤 dictation can be used
    if (nativeSpeechReady()) {
      if (listening) { stopNativeSpeech(); return; }
      setMsg(''); setListening(true);
      startNativeSpeech(tLocale(lang), (s) => setText(s), (s, denied) => {
        setListening(false);
        if (denied) setMsg(q.micDenied); else if (s) send(s);
      });
      return;
    }
    if (!SR || isNativeApp()) { inputRef.current?.focus(); setMsg(isNativeApp() ? q.micApp : q.micNo); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = tLocale(lang);
    rec.interimResults = true;
    let final = '';
    rec.onresult = (ev: any) => {
      let s = '';
      for (let i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript;
      setText(s);
      if (ev.results[ev.results.length - 1].isFinal) final = s;
    };
    rec.onerror = () => { setListening(false); setMsg(q.micNo); };
    rec.onend = () => { setListening(false); if (final.trim()) send(final); };
    recRef.current = rec;
    setMsg(''); setListening(true);
    try { rec.start(); } catch { setListening(false); setMsg(q.micNo); }
  }

  const when = (d: Draft) => d.allDay
    ? `${fmtDay(new Date(d.start), lang)} · ${q.allDay}`
    : `${fmtDay(new Date(d.start), lang)} ${fmtTime(d.start, lang)}–${fmtTime(d.end, lang)}`;

  return (
    <section className="card quickadd">
      <form className="qa-row" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <GrowBox ref={inputRef} value={text} onChange={setText} onEnter={() => send()} placeholder={listening ? q.listening : q.ph} ariaLabel={q.ph} />
        <button type="button" className={`qa-mic ${listening ? 'on' : ''}`} onClick={mic} aria-label={q.mic} aria-pressed={listening}>🎤</button>
        <button className="primary qa-go" disabled={busy || !text.trim()}>{busy ? '…' : q.add}</button>
      </form>
      {busy && <p className="tiny" aria-live="polite">{q.thinking}</p>}
      {msg && <p className="small" role="status">{msg} {limitHit && <button className="link" onClick={() => upgrade('basic', 'year')}>{t.bill.upgrade(t.bill.basic)}</button>}</p>}
      {drafts && (
        <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) setDrafts(null); }}>
          <div className="sheet form" role="dialog" aria-modal="true" aria-labelledby="qa-h">
            <span className="grab" aria-hidden="true" />
            <h3 id="qa-h">{q.found(drafts.length)}</h3>
            {drafts.map((d, i) => {
              const r = readEvent(chart, d, events);
              const alt = r.alternatives[0];
              const set = (patch: Partial<Draft>) => setDrafts(drafts.map((x, k) => (k === i ? { ...x, ...patch } : x)));
              return (
                <div key={d.id} className="qa-item">
                  <div className="row between top-align gap">
                    <div>
                      <div className="ev-title">{d.title}</div>
                      <div className="small muted">{when(d)}</div>
                      {d.repeat && <div className="small">{repeatText(d.repeat, lang)}</div>}
                      {d.assumed && <div className="tiny">💡 {q.guessed}: {d.assumed}</div>}
                    </div>
                    <span className={`vscore ${r.verdict}`}>{t[r.verdict]} {r.score}</span>
                  </div>
                  <div className="row gap wrap" style={{ marginTop: 8 }}>
                    {d.orig
                      ? <><span className="small">{q.usingBetter}</span><button type="button" className="link" onClick={() => set({ start: d.orig!.start, end: d.orig!.end, orig: undefined })}>{q.undo}</button></>
                      : !d.allDay && alt && r.verdict !== 'good' && !d.repeat && (
                        <button type="button" className="softbtn" onClick={() => set({ start: alt.start, end: alt.end, orig: { start: d.start, end: d.end } })}>
                          ⇢ {q.useBetter(`${sameDay(new Date(alt.start), new Date(d.start)) ? '' : fmtDay(new Date(alt.start), lang) + ' '}${fmtTime(alt.start, lang)}`, alt.score)}
                        </button>)}
                    {drafts.length > 1 && <button type="button" className="link danger" onClick={() => setDrafts(drafts.filter((_, k) => k !== i))}>{q.remove}</button>}
                  </div>
                </div>
              );
            })}
            <div className="row gap">
              <button className="primary grow" onClick={() => {
                onAdd(drafts.map(({ assumed, orig, ...e }) => ({ ...e, id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}` })));
                setMsg(q.saved(drafts.length)); setDrafts(null); clearAfterSend(text, setText);
              }}>{q.saveAll(drafts.length)}</button>
              <button type="button" className="ghost" onClick={() => setDrafts(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AddEvent({ lang, day, onSave, onCancel }: { lang: Lang; day: Date; onSave: (e: CalEvent) => void; onCancel: () => void }) {
  const t = T[lang];
  const v = t.v2;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('');
  const [date, setDate] = useState(isoLocalDate(day));
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('15:00');
  const [rep, setRep] = useState<'' | 'daily' | 'weekly' | 'monthly'>('');
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel]);
  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <form className="sheet form" role="dialog" aria-modal="true" aria-labelledby="sheet-h" onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const s = new Date(`${date}T${from}`), en = new Date(`${date}T${to}`);
        if (en <= s) en.setTime(s.getTime() + 3600e3);
        onSave({ id: `m${Date.now()}`, title: title.trim(), start: s.toISOString(), end: en.toISOString(), source: 'manual', ...(rep ? { repeat: { freq: rep } } : {}) });
      }}>
        <span className="grab" aria-hidden="true" />
        <h3 id="sheet-h">{v.newEvent}</h3>
        <div className="quick">
          {v.quick.map(([em, k]) => (
            <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setTitle(v.quickTitle[k]); }}>{em} {k}</button>
          ))}
        </div>
        <label>{t.title}<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L3(lang, 'Partnership talk with Mr. Zhang', '和张总谈合作', 'Reunión con la Sra. García')} required autoFocus /></label>
        <label>{t.date}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="row gap">
          <label className="grow">{t.from}<input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="grow">{t.to}<input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <label>{t.qa.repeat}
          <select value={rep} onChange={(e) => setRep(e.target.value as typeof rep)}>
            <option value="">{t.qa.never}</option>
            <option value="daily">{t.qa.rep.daily}</option>
            <option value="weekly">{t.qa.rep.weekly}</option>
            <option value="monthly">{t.qa.rep.monthly}</option>
          </select>
        </label>
        <div className="row gap">
          <button className="primary grow">{t.save}</button>
          <button type="button" className="ghost" onClick={onCancel}>{t.cancel}</button>
        </div>
      </form>
    </div>
  );
}

function EventCard({ lang, chart, ev, all, onMove, onDelete }: { lang: Lang; chart: Chart; ev: CalEvent; all: CalEvent[]; onMove: (s: string, e: string) => void; onDelete: () => void }) {
  const t = T[lang];
  const v = t.v2;
  const r = useMemo(() => readEvent(chart, ev, all), [chart, ev, all]);
  const [why, setWhy] = useState(false);
  const [copied, setCopied] = useState(false);
  // lead with what is specific to this event: the almanac for its activity, then its hour, then the day
  const rank = (x: { scope: string }) => (x.scope.startsWith('almanac') ? 0 : x.scope === 'hour' ? 1 : 2);
  const tops = [...r.reasons].sort((a, b) => rank(a) - rank(b) || Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
  const actLabel = r.category === 'general' ? '' : L3(lang, `For ${activityName(r.category, lang)}: `, `${activityName(r.category, lang)}：`, `Para ${activityName(r.category, lang)}: `);
  const alt = r.alternatives[0];
  const sameD = alt ? sameDay(new Date(alt.start), new Date(ev.start)) : false;
  const altLabel = alt ? `${sameD ? '' : fmtDay(new Date(alt.start), lang) + ' '}${fmtTime(alt.start, lang)}` : '';
  const note = alt
    ? lang === 'es'
      ? `¡Hola! ¿Podríamos mover «${ev.title}» del ${fmtDay(new Date(ev.start), lang)} ${fmtTime(ev.start, lang)} al ${fmtDay(new Date(alt.start), lang)} ${fmtTime(alt.start, lang)}? ¡Gracias!`
      : lang === 'zh'
      ? `您好，「${ev.title}」原定 ${fmtDay(new Date(ev.start), lang)} ${fmtTime(ev.start, lang)}，可否改到 ${fmtDay(new Date(alt.start), lang)} ${fmtTime(alt.start, lang)}？谢谢！`
      : `Hi! Could we move "${ev.title}" from ${fmtDay(new Date(ev.start), lang)} ${fmtTime(ev.start, lang)} to ${fmtDay(new Date(alt.start), lang)} ${fmtTime(alt.start, lang)}? Thanks!`
    : '';
  const st = new Date(ev.start);
  const tb = ev.allDay
    ? { a: L3(lang, 'All', '全天', 'Todo'), b: L3(lang, 'day', '', 'el día') }
    : lang !== 'en'
      ? { a: `${st.getHours()}:${pad(st.getMinutes())}`, b: lang === 'es' ? (st.getHours() < 12 ? 'mañana' : st.getHours() < 20 ? 'tarde' : 'noche') : st.getHours() < 12 ? '上午' : '下午' }
      : { a: `${((st.getHours() + 11) % 12) + 1}:${pad(st.getMinutes())}`, b: st.getHours() < 12 ? 'AM' : 'PM' };
  const full = useBill().info.limits.fullReasons;
  const showMove = full && !ev.allDay && !!alt && r.verdict !== 'good';

  return (
    <article className={`card event ${r.verdict === 'bad' ? 'warn' : ''}`}>
      <div className="row gap top-align">
        <div className="tblock"><b>{tb.a}</b><span>{tb.b}</span></div>
        <div className="grow">
          <div className="row between top-align gap">
            <div className="ev-title">{ev.title}</div>
            <span className={`vscore ${r.verdict}`}>{t[r.verdict]} {r.score}</span>
          </div>
          {ev.seriesId && <div className="srctag">{repeatText(ev.repeat, lang)}</div>}
          {ev.source !== 'manual' && <div className="srctag">{ev.source === 'email' ? `📧 ${v.fromMail}${ev.from ? ` · ${ev.from.split('@').pop()}` : ''}` : `🗓️ ${v.fromCal}`}</div>}
          {tops.length > 0 && <div className="evline">{actLabel}{tops.map((x) => reasonText(x, lang)).join(' ')}</div>}
          {!ev.allDay && r.verdict === 'good' && alt && <div className="evline">{t.evenBetter} <b>{altLabel}</b> ({alt.score})</div>}
          {!ev.allDay && r.verdict === 'bad' && !alt && <div className="evline">{t.noBetter}</div>}
        </div>
      </div>
      <div className="evactions">
        {showMove && (ev.source !== 'calendar'
          ? <button className="primary" onClick={() => onMove(alt.start, alt.end)}>⇢ {sameD ? v.moveTo : v.tryDay} {altLabel} ({alt.score})</button>
          : <button className="primary" onClick={() => { navigator.clipboard?.writeText(note); setCopied(true); }}>{copied ? t.copied : `${t.copyNote} · ${altLabel}`}</button>)}
        {full && <button className="softbtn" onClick={() => setWhy(!why)} aria-expanded={why}>{why ? t.hide : t.why}</button>}
        {ev.source === 'email' && showMove && <button className="link" onClick={() => { navigator.clipboard?.writeText(note); setCopied(true); }}>{copied ? t.copied : t.copyNote}</button>}
        {ev.source !== 'calendar' && <button className="link danger" onClick={onDelete}>{t.del}</button>}
      </div>
      {!full && r.verdict !== 'good' && <Locked lang={lang} text={t.bill.lockedWhy} />}
      {showMove && ev.source === 'calendar' && <p className="tiny">{t.calendarNote}</p>}
      {ev.source === 'email' && showMove && <p className="tiny">{v.mailMoveNote}</p>}
      {why && (
        <div className="whybox">
          <ul>
            {r.reasons.map((x, i) => <li key={i}><span className={x.delta >= 0 ? 'plus' : 'minus'}>{x.delta >= 0 ? '+' : ''}{x.delta}</span> {reasonText(x, lang)}</li>)}
          </ul>
          <p className="tiny" style={{ marginTop: 6 }}>{lang === 'zh' ? `综合 ${r.score} 分 · 日 ${r.dayGanZhi} · 时 ${r.hourGanZhi}` : lang === 'es' ? `Puntuación ${r.score} · día ${STEM[r.dayGanZhi[0]].pinyin}-${BRANCH[r.dayGanZhi[1]].pinyin} · hora del ${ANIMAL_ES[BRANCH[r.hourGanZhi[1]].animal]}` : `Score ${r.score} · ${STEM[r.dayGanZhi[0]].pinyin}-${BRANCH[r.dayGanZhi[1]].pinyin} day · ${BRANCH[r.hourGanZhi[1]].animal} hour`}</p>
        </div>
      )}
    </article>
  );
}

// ---------------- ask ----------------

// Shrink a photo in the browser before sending: max 1280px on the long side, JPEG.
async function shrinkImage(file: File): Promise<{ media_type: string; data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const preview = c.toDataURL('image/jpeg', 0.85);
    return { media_type: 'image/jpeg', data: preview.split(',')[1], preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Ask({ lang, chart, events, profile, seed, clearSeed }: { lang: Lang; chart: Chart; events: CalEvent[]; profile: Profile; seed: Seed | null; clearSeed: () => void }) {
  const t = T[lang];
  const bill = useBill();
  // keep the conversation between visits (text only; photos are not stored)
  const [msgs, setMsgs] = useState<Msg[]>(() => (typeof window === 'undefined' ? [] : load<Msg[]>(K.chat, [])));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (busy) return;
    save(K.chat, msgs.filter((m) => m.text).slice(-60).map(({ role, text, upsell }) => ({ role, text, upsell })));
  }, [msgs, busy]);
  const [photo, setPhoto] = useState<Pic | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const recRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVoiceOk(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); }, []);
  // a question handed over from another screen (e.g. a room photo from Feng Shui)
  useEffect(() => {
    if (!seed) return;
    const s = seed;
    clearSeed();
    send(s.q, s.photo ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleVoice() {
    if (listening) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = tLocale(lang);
    rec.interimResults = true;
    rec.continuous = false;
    const base = q ? q + ' ' : '';
    rec.onresult = (e: any) => { let txt = ''; for (const r of e.results) txt += r[0].transcript; setQ((base + txt).slice(0, 500)); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function send(question: string, given?: Pic | null) {
    const pic = given === undefined ? photo : given;
    if ((!question.trim() && !pic) || busy) return;
    const history = msgs;
    setMsgs([...history, { role: 'user', text: question || L3(lang, 'What about this photo?', '帮我看看这张图', '¿Qué opinas de esta foto?'), image: pic?.preview }, { role: 'assistant', text: '' }]);
    clearAfterSend(question, setQ);
    setPhoto(null);
    setBusy(true);
    const put = (text: string) => setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', text }]);
    const fallback = (lead: string) => put(pic && !question ? lead : `${lead}\n\n${fallbackAnswer(chart, question, lang)}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({
          question, lang, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, history: history.map(({ role, text }) => ({ role, text })),
          context: buildContext(chart, events, question, lang, { birthYear: birthFsYear(profile.birth), sex: profile.sex }),
          image: pic ? { media_type: pic.media_type, data: pic.data } : undefined,
        }),
      });
      if (res.status === 503) fallback(t.offline);
      else if (res.status === 429 || res.status === 402) {
        const j = await res.json().catch(() => null);
        const text = j?.error === 'daily_limit' ? t.bill.askLimit(j.limit) : j?.feature === 'photos' ? t.bill.photoLocked : t.rateLimited;
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', text, upsell: j?.error === 'daily_limit' || j?.feature === 'photos' }]);
      }
      else if (!res.ok || !res.body) fallback(t.aiError);
      else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let text = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
          if (text.includes('\u0000ERROR')) break;
          put(text);
        }
        if (text.includes('\u0000ERROR') || !text.trim()) fallback(t.aiError);
      }
    } catch {
      fallback(t.aiError);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <div className="stack chat">
      <div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <h1>{t.askTitle}</h1>
          {msgs.length > 0 && !busy && <button className="link small" onClick={() => setMsgs([])}>{L3(lang, 'New chat', '清空对话', 'Nueva conversación')}</button>}
        </div>
        <p className="muted">{t.askHint}</p>
      </div>
      <div className="msgs">
        {msgs.map((m, i) => (m.text || m.image ? (
          <div key={i} className={`bubble ${m.role}`}>
            {m.image && <img className="shot" src={m.image} alt={t.photoAlt} />}
            {m.text.replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '')}
            {m.upsell && <div style={{ marginTop: 8 }}><button className="primary" onClick={() => bill.upgrade('basic')}>{t.bill.upgrade(t.bill.basic)}</button></div>}
            {m.role === 'assistant' && !m.upsell && !(busy && i === msgs.length - 1) && (
              <div className="basis" aria-label={t.v2.basis}>
                <span>{t.v2.basisChart}</span><span>{t.v2.basisDay}</span>
                {events.length > 0 && <span>{t.v2.basisCal}</span>}
                {msgs[i - 1]?.image && <span>{t.v2.basisPhoto}</span>}
              </div>
            )}
          </div>
        ) : null))}
        {busy && !msgs.at(-1)?.text && <div className="bubble assistant" aria-live="polite" aria-label={t.thinking}><span className="typing" aria-hidden="true"><i /><i /><i /></span></div>}
      </div>
      {!busy && (
        <div className="sugg">
          {t.examples.map((ex) => <button key={ex} className="example" onClick={() => send(ex)}>{ex}</button>)}
          <button className="example" onClick={() => (photosOk() ? fileRef.current?.click() : alertUpdate(lang))}>📷 {t.photoExample}</button>
        </div>
      )}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        {photo && (
          <div className="attach">
            <img src={photo.preview} alt={t.photoAlt} />
            <button type="button" className="x" onClick={() => setPhoto(null)} aria-label={t.removePhoto}>×</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) { try { setPhoto(await shrinkImage(f)); } catch { /* unreadable image */ } }
        }} />
        <button type="button" className="iconbtn" onClick={() => (photosOk() ? fileRef.current?.click() : alertUpdate(lang))} aria-label={t.addPhoto} disabled={busy}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2.5" /><circle cx="12" cy="12.5" r="3.5" /><path d="M8.5 5l1.5-2h4l1.5 2" /></svg>
        </button>
        {voiceOk && (
          <button type="button" className={`iconbtn ${listening ? 'live' : ''}`} onClick={toggleVoice} aria-label={listening ? t.stopVoice : t.voice} aria-pressed={listening} disabled={busy}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
          </button>
        )}
        <label className="sr" htmlFor="q">{t.askTitle}</label>
        <GrowBox id="q" value={q} onChange={setQ} onEnter={() => send(q)} placeholder={listening ? t.listening : photo ? t.photoPlaceholder : t.askPlaceholder} maxLength={500} />
        <button className="primary" disabled={busy || (!q.trim() && !photo)}>{t.send}</button>
      </form>
    </div>
  );
}

// ---------------- feng shui ----------------

const GRID: (Dir | 'C')[] = ['NW', 'N', 'NE', 'W', 'C', 'E', 'SW', 'S', 'SE'];
const amazon = (q: string) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=fatecal-20`;

function FengShui({ lang, chart, profile, setSex, ask }: { lang: Lang; chart: Chart; profile: Profile; setSex: (s: Sex) => void; ask: (s: Seed) => void }) {
  const t = T[lang];
  const f = t.fs;
  const nextOk = useBill().info.limits.nextYearStars;
  const [yearLocked, setYearLocked] = useState(false);
  const zh = lang === 'zh';
  const dn = (d: Dir) => DIR_NAME[d][lang];
  const el = (e: Element) => ELEMENT_NAME[e][lang];
  const kua = profile.sex ? kuaOf(birthFsYear(profile.birth), profile.sex) : null;
  const thisYear = liChunYear(new Date());
  const [yr, setYr] = useState(thisYear);
  const stars = annualStars(yr);
  const [cell, setCell] = useState<Dir | 'C' | null>(null);
  const [facing, setFacing] = useState<Dir | null>(null);
  const [compass, setCompass] = useState<'off' | 'on' | 'no'>('off');
  const [heading, setHeading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gotHeading = useRef(false);
  const home = facing ? readHome(facing, kua, chart.favorable, thisYear) : null;

  useEffect(() => {
    if (compass !== 'on') return;
    const onOri = (e: any) => {
      const h = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : e.absolute && typeof e.alpha === 'number' ? 360 - e.alpha : null;
      if (h === null) return;
      gotHeading.current = true;
      setHeading(Math.round(h));
      setFacing(dirFromDegrees(h));
    };
    const ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(ev, onOri);
    // no reading after a few seconds means this device has no usable compass
    const none = setTimeout(() => { if (!gotHeading.current) setCompass('no'); }, 3000);
    return () => { window.removeEventListener(ev, onOri); clearTimeout(none); };
  }, [compass]);
  async function startCompass() {
    const D = (window as any).DeviceOrientationEvent;
    if (!D) { setCompass('no'); return; }
    try { if (typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') { setCompass('no'); return; } } catch { setCompass('no'); return; }
    gotHeading.current = false;
    setHeading(null);
    setCompass('on');
  }

  const c = cell ? FLY[stars[cell]] : null;
  return (
    <div className="stack">
      <div>
        <h1>{f.title}</h1>
        <p className="muted">{f.intro}</p>
      </div>

      <section className="card">
        <div className="row between">
          <div className="label">{f.myDirs}</div>
          {kua && <button className="link" onClick={() => setSex(profile.sex === 'm' ? 'f' : 'm')}>{profile.sex === 'm' ? f.male : f.female} · {f.changeSex}</button>}
        </div>
        {!kua ? (
          <>
            <p className="small">{f.sexAsk}</p>
            <div className="seg">
              <button onClick={() => setSex('m')}>{f.male}</button>
              <button onClick={() => setSex('f')}>{f.female}</button>
            </div>
          </>
        ) : (
          <>
            {(() => {
              const p = f.plain;
              const at = (st: string) => kua.dirs.find((d) => d.star === st)!.dir;
              const col = zh ? '：' : ': ', pa = (x: string) => (zh ? `（${x}）` : ` (${x})`);
              const bad = kua.dirs.filter((d) => !STAR8[d.star].good && d.star !== 'jueming').map((d) => dn(d.dir)).join(zh ? '、' : ', ');
              return (
                <ul className="fsplain">
                  <li><span>🛏</span><div>{p.bed} <b className="plus">{dn(at('tianyi'))}</b>{pa(p.health)} {p.or} <b className="plus">{dn(at('yannian'))}</b>{pa(p.love)}</div></li>
                  <li><span>💼</span><div>{p.desk}{col}<b className="plus">{dn(at('shengqi'))}</b></div></li>
                  <li><span>📖</span><div>{p.study}{col}<b className="plus">{dn(at('fuwei'))}</b></div></li>
                  <li><span>🚽</span><div>{p.utility}{col}<b>{bad}</b></div></li>
                  <li><span>🚫</span><div>{p.never} <b className="minus">{dn(at('jueming'))}</b></div></li>
                </ul>
              );
            })()}
            <details className="fsdetails">
              <summary className="small">{f.plain.why}</summary>
              <p className="small">{f.plain.kua(zh ? kua.trigram.zh : kua.trigram.en, kua.group === 'east' ? f.eastGroup : f.westGroup)}</p>
              <div className="small"><b>{f.goodDirs}</b></div>
              <ul className="reasons">
                {kua.dirs.filter((d) => STAR8[d.star].good).map((d) => (
                  <li key={d.star}><span className="plus">{dn(d.dir)}</span> {STAR8[d.star][lang]}: {L3(lang, STAR8[d.star].useEn, STAR8[d.star].useZh, STAR8[d.star].useEs)}</li>
                ))}
              </ul>
              <div className="small"><b>{f.badDirs}</b></div>
              <ul className="reasons">
                {kua.dirs.filter((d) => !STAR8[d.star].good).map((d) => (
                  <li key={d.star}><span className="minus">{dn(d.dir)}</span> {STAR8[d.star][lang]}: {L3(lang, STAR8[d.star].useEn, STAR8[d.star].useZh, STAR8[d.star].useEs)}</li>
                ))}
              </ul>
              <p className="small"><b>{f.elDirs}:</b> {DIRS.filter((d) => chart.favorable.includes(DIR_ELEMENT[d])).map((d) => `${dn(d)} (${el(DIR_ELEMENT[d])})`).join(zh ? '、' : ', ')}</p>
            </details>
          </>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <div className="label">{f.stars}</div>
          <div className="seg sm">
            <button className={yr === thisYear ? 'on' : ''} onClick={() => { setYr(thisYear); setCell(null); }}>{thisYear}</button>
            <button className={yr === thisYear + 1 ? 'on' : ''} onClick={() => { if (!nextOk) { setYearLocked(true); return; } setYr(thisYear + 1); setCell(null); }}>{nextOk ? '' : '🔒 '}{thisYear + 1}</button>
          </div>
        </div>
        {yearLocked && !nextOk && <Locked lang={lang} text={t.bill.lockedYear} />}
        <p className="small">{f.starsIntro}</p>
        {(() => {
          const where = (n: number) => { const g = GRID.find((x) => stars[x] === n)!; return g === 'C' ? f.center : dn(g); };
          return <p className="small fsyear"><b>{f.plain.year(where(8), where(4), where(5))}</b></p>;
        })()}
        <div className="fsmap-cap tiny">⬆ {dn('N')} · {f.mapCap}</div>
        <div className="fsgrid fshouse" role="grid">
          {GRID.map((g) => {
            const st = FLY[stars[g]];
            return (
              <button key={g} role="gridcell" className={`fscell ${st.tone} ${cell === g ? 'sel' : ''}`} onClick={() => setCell(cell === g ? null : g)} aria-pressed={cell === g}
                aria-label={`${g === 'C' ? f.center : dn(g)}: ${st[lang]}, ${L3(lang, st.en2, st.zh2, st.es2)}`}>
                <span className="tiny">{g === 'C' ? f.center : dn(g)}</span>
                <b className="fsemoji" aria-hidden="true">{FLY_PLAIN[stars[g]].emoji}</b>
                <span className="fslabel">{FLY_PLAIN[stars[g]][lang]}</span>
                <span className="tiny muted">{stars[g]}</span>
              </button>
            );
          })}
        </div>
        {c && (
          <div className="suggest">
            <p className="small"><b>{cell === 'C' ? f.center : dn(cell as Dir)} · {FLY_PLAIN[stars[cell!]].emoji} {FLY_PLAIN[stars[cell!]][lang]}</b>: {L3(lang, c.en2, c.zh2, c.es2)}</p>
            <p className="small">{L3(lang, c.fixEn, c.fixZh, c.fixEs)}</p>
          </div>
        )}
        <h3 className="fslist-h">{f.listH}</h3>
        <ul className="fslist">
          {[...GRID].sort((x, y) => ({ good: 0, neutral: 1, bad: 2 }[FLY[stars[x]].tone] - { good: 0, neutral: 1, bad: 2 }[FLY[stars[y]].tone])).map((g) => {
            const st = FLY[stars[g]], pl = FLY_PLAIN[stars[g]];
            return (
              <li key={g} className={st.tone}>
                <div className="row between"><b>{pl.emoji} {g === 'C' ? f.center : dn(g)} · {pl[lang]}</b><span className={`fstag ${st.tone}`}>{st.tone === 'bad' ? f.calm : f.good}</span></div>
                <p className="small">{L3(lang, st.fixEn, st.fixZh, st.fixEs)}</p>
              </li>
            );
          })}
        </ul>
        <p className="tiny muted">{f.starsFrom2} · {zh ? `${yr}年 ${yearGanZhi(yr)}，` : `${yr} (${yearGanZhi(yr)}), `}{f.starsFrom}</p>
      </section>

      <section className="card form">
        <div className="label">{f.check}</div>
        <p className="small muted">{f.checkIntro}</p>
        <label>{f.facing}
          <select value={facing ?? ''} onChange={(e) => { setCompass('off'); setHeading(null); setFacing((e.target.value || null) as Dir | null); }}>
            <option value="">—</option>
            {DIRS.map((d) => <option key={d} value={d}>{dn(d)}</option>)}
          </select>
        </label>
        <button type="button" className="ghost" onClick={startCompass}>{f.useCompass}</button>
        {compass === 'on' && <p className="small muted" aria-live="polite">{heading === null ? f.compassHold : `${f.heading} ${heading}° → ${facing ? dn(facing) : ''}`}</p>}
        {compass === 'no' && <p className="small muted">{f.compassNo}</p>}
        {home && (
          <div className="suggest">
            <div className="row gap"><VerdictTag v={home.verdict} lang={lang} /><b>{f.houseSits} {dn(home.sitting)} {f.houseFaces} {dn(home.facing)} · {home.score}</b></div>
            <ul className="reasons">{home.notes.map((n, i) => <li key={i}>{n[lang]}</li>)}</ul>
            {SHOPPING_ON && FLY[home.doorStarThisYear].query && FLY[home.doorStarThisYear].tone === 'bad' && (
              <a className="link shopping-link" href={amazon(FLY[home.doorStarThisYear].query!)} target="_blank" rel="sponsored nofollow noopener noreferrer">{f.shop}</a>
            )}
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="label">{f.photo}</div>
        <p className="small muted">{f.photoIntro}</p>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try { ask({ q: f.photoQ, photo: await shrinkImage(file) }); } catch { /* unreadable image */ }
        }} />
        <button className="primary" onClick={() => (photosOk() ? fileRef.current?.click() : alertUpdate(lang))}>{f.photoBtn}</button>
        <button className="ghost" onClick={() => ask({ q: f.askMoreQ })}>{f.askMore}</button>
      </section>
      <p className="muted small">{f.note}</p>
    </div>
  );
}

// ---------------- chart ----------------

const ZODIAC_EMOJI: Record<string, string> = { 子: '🐭', 丑: '🐮', 寅: '🐯', 卯: '🐰', 辰: '🐲', 巳: '🐍', 午: '🐴', 未: '🐑', 申: '🐵', 酉: '🐔', 戌: '🐶', 亥: '🐷' };
const DM_LINE: Record<string, { en: string; zh: string; es: string }> = {
  甲: { en: 'Like a tall tree: upright, steady, always growing toward a goal.', zh: '像参天大树：正直、稳当，总是一路往上长。', es: 'Como un árbol alto: recto, firme, siempre creciendo hacia una meta.' },
  乙: { en: 'Like vines and flowers: flexible, easy to be around, always finds a way.', zh: '像花草藤蔓：灵活、好相处，总能找到出路。', es: 'Como enredaderas y flores: flexible, agradable, siempre encuentras un camino.' },
  丙: { en: 'Like the sun: warm, open and generous; you light up a room.', zh: '像太阳：热情大方，走到哪儿亮到哪儿。', es: 'Como el sol: cálido, abierto y generoso; iluminas el lugar.' },
  丁: { en: 'Like candlelight: thoughtful, warm, focused on what matters.', zh: '像烛光：细腻、温暖，专注在要紧的事上。', es: 'Como la luz de una vela: atento, cálido, centrado en lo que importa.' },
  戊: { en: 'Like a mountain: reliable and calm; people feel safe around you.', zh: '像大山：可靠、沉稳，让人有安全感。', es: 'Como una montaña: confiable y sereno; la gente se siente segura contigo.' },
  己: { en: 'Like garden soil: nurturing, practical and patient.', zh: '像田园沃土：会照顾人，务实、有耐心。', es: 'Como tierra de jardín: cuidas a los demás, práctico y paciente.' },
  庚: { en: 'Like a blade: decisive and principled.', zh: '像一把刀：果断、讲原则。', es: 'Como una espada: decidido y con principios.' },
  辛: { en: 'Like fine jewelry: refined, precise, with an eye for quality.', zh: '像珠宝：精致、讲究，眼光高。', es: 'Como una joya fina: refinado, preciso, con buen ojo para la calidad.' },
  壬: { en: 'Like a great river: big-picture, adaptable, always moving.', zh: '像江河：眼界大、会变通，停不下来。', es: 'Como un gran río: visión amplia, adaptable, siempre en movimiento.' },
  癸: { en: 'Like rain and dew: intuitive, gentle and quietly persistent.', zh: '像雨露：直觉强、温柔，默默坚持。', es: 'Como la lluvia y el rocío: intuitivo, amable y silenciosamente constante.' },
};
const ELS: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
const SUN_ES: Record<string, string> = { Aries: 'Aries', Taurus: 'Tauro', Gemini: 'Géminis', Cancer: 'Cáncer', Leo: 'Leo', Virgo: 'Virgo', Libra: 'Libra', Scorpio: 'Escorpio', Sagittarius: 'Sagitario', Capricorn: 'Capricornio', Aquarius: 'Acuario', Pisces: 'Piscis' };
const EL_HAN: Record<Element, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

function ChartView({ lang, chart, profile, onEdit }: { lang: Lang; chart: Chart; profile: Profile; onEdit: (p: Profile) => void }) {
  const t = T[lang];
  const v = t.v2;
  const [editing, setEditing] = useState(false);
  if (editing) return <Onboarding lang={lang} setLang={() => {}} initial={profile} onDone={(p) => { onEdit(p); setEditing(false); }} onCancel={() => setEditing(false)} />;
  const zh = lang === 'zh';
  const el = (e: Element) => ELEMENT_NAME[e][lang];
  const total = ELS.reduce((a, e) => a + chart.counts[e], 0) || 1;
  // the visible layer: each stem, plus each branch's main element; the rest of the count comes from hidden stems
  const visible: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  chart.pillars.forEach((p) => {
    if (p.label === 'hour' && chart.hourUnknown) return;
    visible[STEM[p.stem].el] += 1;
    const main = HIDDEN[p.branch][0];
    const w = HIDDEN[p.branch].length === 1 ? 1 : HIDDEN[p.branch].length === 2 ? 0.7 : 0.6;
    visible[STEM[main].el] += w * (p.label === 'month' ? 2 : 1);
  });
  const b = profile.birth;
  const born = new Date(b.year, b.month - 1, b.day, b.hourUnknown ? 12 : b.hour, b.hourUnknown ? 0 : b.minute);
  const bornStr = `${born.toLocaleDateString(tLocale(lang), { year: 'numeric', month: zh ? 'long' : 'short', day: 'numeric' })}${b.hourUnknown ? ` · ${t.timeUnknownShort}` : ` · ${born.toLocaleTimeString(tLocale(lang), { hour: 'numeric', minute: '2-digit' })}`}`;
  const dmEl = chart.dayMasterElement;
  const yinYang = ['甲', '丙', '戊', '庚', '壬'].includes(chart.dayMaster) ? (zh ? '阳' : 'Yang') : (zh ? '阴' : 'Yin');
  const es = lang === 'es';
  return (
    <div className="stack">
      <h1>{t.myChart}</h1>
      <section className="card profcard">
        <div className="zav" aria-hidden="true">{ZODIAC_EMOJI[chart.yearBranch]}</div>
        <div className="grow">
          <b>{profile.name || L3(lang, 'Me', '我', 'Yo')}</b>
          <div className="small muted">{bornStr}{profile.place ? ` · ${profile.place}` : ''}</div>
          <div className="tiny">{zh ? `属${BRANCH[chart.yearBranch].zh} · ${chart.sunSign.zh}` : es ? `${ANIMAL_ES[BRANCH[chart.yearBranch].animal]} · ${SUN_ES[chart.sunSign.en] ?? chart.sunSign.en}` : `${BRANCH[chart.yearBranch].animal} · ${chart.sunSign.en}`} · {t.clockTimeNote}</div>
        </div>
      </section>

      <div className="sechead"><h3>{L3(lang, 'Your four pillars', '你的四柱', 'Tus cuatro pilares')}</h3><span className="tiny">{L3(lang, 'top: stem · bottom: branch', '上：天干 · 下：地支', 'arriba: tronco · abajo: rama')}</span></div>
      <div className="pillars">
        {chart.pillars.map((p) => {
          const hidden = p.label === 'hour' && chart.hourUnknown;
          return (
            <div key={p.label} className={`pillar ${p.label === 'day' ? 'dm' : ''}`}>
              <div className="k">{t[p.label]}{p.label === 'day' ? ` · ${v.you}` : ''}</div>
              <div className="gz">{hidden ? '?' : p.stem}<br />{hidden ? '?' : p.branch}</div>
              {!hidden && <div className="elan">{zh ? `${ELEMENT_NAME[STEM[p.stem].el].zh}${BRANCH[p.branch].zh}` : es ? `${ANIMAL_ES[BRANCH[p.branch].animal]} de ${ELEMENT_NAME[STEM[p.stem].el].es}` : `${ELEMENT_NAME[STEM[p.stem].el].en} ${BRANCH[p.branch].animal}`}</div>}
              <div className="area">{v.areas[p.label]}</div>
              {!hidden && <div className="tiny" title={t.hiddenStems}>{t.hiddenShort} {HIDDEN[p.branch].join('')}</div>}
            </div>
          );
        })}
      </div>

      <section className="card">
        <div className="dmcard">
          <div className="dmchar" aria-hidden="true">{chart.dayMaster}</div>
          <div className="grow">
            <div className="tiny">{v.dmLabel}</div>
            <h3>{zh ? `${yinYang}${ELEMENT_NAME[dmEl].zh} · ${chart.strong ? t.strong : t.weak}` : es ? `${ELEMENT_NAME[dmEl].es} ${yinYang} · ${chart.strong ? t.strong : t.weak}` : `${yinYang} ${ELEMENT_NAME[dmEl].en} · ${chart.strong ? t.strong : t.weak}`}</h3>
            <p className="small">{DM_LINE[chart.dayMaster][lang]}</p>
          </div>
        </div>
        <div className="hg">
          <div><div className="small muted">{v.helps}</div>{chart.favorable.map((e) => <span key={e} className={`elchip ${e}`}>{el(e)}</span>)}</div>
          <div><div className="small muted">{v.easy}</div>{chart.unfavorable.map((e) => <span key={e} className={`elchip ${e}`}>{el(e)}</span>)}</div>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>{chart.strong ? t.strongExplain : t.weakExplain}</p>
      </section>

      <div className="sechead"><h3>{t.elementBalance}</h3></div>
      <section className="card">
        {ELS.map((e) => {
          const pct = Math.round((chart.counts[e] / total) * 100);
          const vis = Math.min(chart.counts[e], visible[e]);
          return (
            <div key={e} className="bar-row">
              <span className="bar-label"><span className="han" style={{ color: `var(--${e})` }}>{EL_HAN[e]}</span>{zh ? '' : ELEMENT_NAME[e][lang]}</span>
              <span className="bar" role="img" aria-label={`${el(e)} ${pct}%`}>
                <span className={`fill hid ${e}`} style={{ width: `${(chart.counts[e] / total) * 100}%` }} />
                <span className={`fill base ${e}`} style={{ width: `${(vis / total) * 100}%` }} />
              </span>
              <span className="pct">{pct}%</span>
            </div>
          );
        })}
        <div className="ellegend"><span><i />{v.visible}</span><span><i className="h" />{v.hiddenL}</span></div>
        <p className="small muted" style={{ marginTop: 8 }}>{t.balanceExplain} {v.lowNotZero}</p>
      </section>

      <section className="card">
        <div className="label">{t.aboutPillars}</div>
        <ul className="reasons">{t.pillarsExplain.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <p className="muted small">{t.simplified}</p>
      <button className="ghost" onClick={() => setEditing(true)}>{t.editBirth}</button>
    </div>
  );
}

// ---------------- settings ----------------

function Settings({ nativeApp, lang, setLang, ics, setIcs, billNote, gcal, gcalNote, onGcalConnect, onGcalRefresh, onGcalDisconnect, onReset, chart, mail, mailAddr, mailUsage, onEnableMail, onCheckMail, onClearMail, account, providers }: { billNote: string; gcal: GcalState | null; gcalNote: string; onGcalConnect: () => void; onGcalRefresh: () => Promise<boolean>; onGcalDisconnect: () => Promise<void>; account: Account | null; providers: string[]; nativeApp: NativeProps | null; lang: Lang; setLang: (l: Lang) => void; ics: { url: string; events: CalEvent[]; at?: string } | null; setIcs: (v: { url: string; events: CalEvent[]; at?: string } | null) => void; onReset: () => void; chart: Chart; mail: MailItem[]; mailAddr: string | null; mailUsage: { used: number; limit: number } | null; onEnableMail: () => Promise<void>; onCheckMail: () => Promise<number>; onClearMail: () => void }) {
  const t = T[lang];
  const [url, setUrl] = useState(ics?.url ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  async function connect() {
    setState('busy');
    const res = await fetch('/api/ics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) }).catch(() => null);
    const j = res && res.ok ? await res.json() : null;
    if (j?.events) { setIcs({ url, events: j.events, at: new Date().toISOString() }); setState('idle'); } else setState('error');
  }
  const calOk = useBill().info.limits.syncCalendar;
  return (
    <div className="stack">
      <h1>{t.settings}</h1>
      <AccountCard lang={lang} account={account} providers={providers} />
      {ACCOUNTS_ON && <PlanCard lang={lang} note={billNote} />}
      <section className="card">
        <div className="label">{t.language}</div>
        <div className="seg">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button>
          <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>Español</button>
        </div>
      </section>
      {ACCOUNTS_ON && <InviteCard lang={lang} />}
      {nativeApp ? <NativeCards lang={lang} n={nativeApp} /> : ACCOUNTS_ON && <ReminderCard lang={lang} />}
      {ACCOUNTS_ON && <WhatsAppCard lang={lang} />}
      <section className="card form">
        <div className="label">{t.calendar}</div>
        {!calOk ? <Locked lang={lang} text={t.bill.lockedCal} /> : <GcalCard lang={lang} gcal={gcal} note={gcalNote} onConnect={onGcalConnect} onRefresh={onGcalRefresh} onDisconnect={onGcalDisconnect} />}
        {calOk && <>
        <div className="orline small muted">{t.gc.orPaste}</div>
        <label>{t.icsLabel}<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" inputMode="url" /></label>
        <p className="muted small">{t.icsHelp}</p>
        {ics?.url ? (
          <div className="row gap">
            <span className="small grow">{ics.events.length} {t.synced}</span>
            <button className="ghost" onClick={() => { setIcs(null); setUrl(''); }}>{t.disconnect}</button>
          </div>
        ) : (
          <button className="primary" disabled={!url || state === 'busy'} onClick={connect}>{state === 'busy' ? t.syncing : t.connect}</button>
        )}
        {state === 'error' && <p className="danger small">{t.icsError}</p>}
        </>}
      </section>
      <MailSection lang={lang} chart={chart} mail={mail} mailAddr={mailAddr} usage={mailUsage} onEnable={onEnableMail} onCheck={onCheckMail} onClear={onClearMail} />
      <p className="muted small">{t.privacy}</p>
      <button className="ghost danger danger-btn" onClick={onReset}>{t.reset}</button>
      <Footer lang={lang} />
    </div>
  );
}

// Shown on the landing page when someone arrives with ?code=…: what the gift is and how many places are left.
function PromoBanner({ lang }: { lang: Lang }) {
  const b = T[lang].bill;
  const [left, setLeft] = useState<number | null>(null);
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    try { setInvited(!!localStorage.getItem(REF_KEY)); } catch { /* ignore */ }
    const c = (() => { try { return localStorage.getItem(PROMO_KEY); } catch { return null; } })();
    if (c) fetch(`/api/promo?code=${encodeURIComponent(c)}`).then((r) => r.json()).then((j) => setLeft(j.left)).catch(() => {});
  }, []);
  if (invited && left === null) return <div className="promo" role="status">{T[lang].inv.banner}</div>;
  if (left === null) return null;
  return <div className="promo" role="status">{left > 0 ? b.promoBanner(left) : b.codeFull}</div>;
}

function PlanCard({ lang, note }: { lang: Lang; note: string }) {
  const { info, upgrade, manage, refresh } = useBill();
  const b = T[lang].bill;
  const [iv, setIv] = useState<Interval>('year');
  const [busy, setBusy] = useState(false);
  const d = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(tLocale(lang), { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  const [codeMsg, setCodeMsg] = useState('');
  const [code, setCode] = useState('');
  const giftMsg = (k: string, until?: string) => (k === 'gift' ? b.redeemed(d(until)) : k === 'gift_full' ? b.codeFull : k === 'gift_used' ? b.codeUsed : k === 'gift_invalid' ? b.codeInvalid : '');
  const msg = codeMsg || (note === 'success' ? b.done : note === 'cancel' ? b.cancelled : note === 'unavailable' ? b.unavailable : giftMsg(note, info.grantUntil));
  const paidLive = info.status === 'active' || info.status === 'trialing' || info.status === 'past_due';
  async function redeemCode() {
    if (!code.trim()) return;
    setBusy(true);
    const j = await fetch('/api/promo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }).then((r) => r.json()).catch(() => ({ ok: false, error: 'invalid' }));
    setBusy(false);
    setCodeMsg(giftMsg(j.ok ? 'gift' : `gift_${j.error}`, j.grant?.until));
    if (j.ok) { setCode(''); refresh(); }
  }
  const tiers: { id: Plan; list: string[] }[] = [{ id: 'free', list: b.freeList }, { id: 'basic', list: b.basicList }, { id: 'premium', list: b.premiumList }];
  return (
    <section className="card stack planbox">
      <div className="row between">
        <div className="label">{b.plan}</div>
        <span className={`planpill ${info.plan}`}>{b[info.plan]}</span>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      {info.plan !== 'free' && (
        <>
          <p className="small muted">
            {!paidLive && info.grantUntil ? b.giftUntil(d(info.grantUntil)) : info.status === 'trialing' && info.trialEnd ? b.trialEnds(d(info.trialEnd)) : info.cancelAtPeriodEnd ? b.ends(d(info.periodEnd)) : info.periodEnd ? b.renews(d(info.periodEnd)) : ''}
          </p>
          {paidLive && info.interval && (() => {
            const pr = PRICES[info.plan as 'basic' | 'premium'];
            const fmt = (iv: Interval) => `${money(pr[iv].cents)}${iv === 'month' ? b.perMonth : b.perYear}`;
            return <p className="small">{b.current(fmt(info.interval!), fmt(info.interval === 'month' ? 'year' : 'month'))}</p>;
          })()}
          {info.hasCustomer && <button className="ghost" onClick={manage}>{b.manage}</button>}
        </>
      )}
      {info.plan === 'free' && isIosApp() && <p className="small muted">{b.iosNote}</p>}
      {info.plan === 'free' && !isIosApp() && (
        <>
          <div className="seg sm">
            <button className={iv === 'month' ? 'on' : ''} onClick={() => setIv('month')}>{b.monthly}</button>
            <button className={iv === 'year' ? 'on' : ''} onClick={() => setIv('year')}>{b.yearly} · {b.save}</button>
          </div>
          <div className="tiers">
            {tiers.map((tier) => {
              const price = tier.id === 'free' ? null : PRICES[tier.id][iv];
              const open = tier.id === 'basic' || (tier.id === 'premium' && info.premiumOpen);
              return (
                <div key={tier.id} className={`tier ${tier.id} ${tier.id === 'basic' ? 'hl' : ''}`}>
                  <div className="row between"><b>{b[tier.id]}</b>{price ? <span><b>{money(price.cents)}</b><span className="tiny">{iv === 'month' ? b.perMonth : b.perYear}</span></span> : <b>$0</b>}</div>
                  <ul>{tier.list.map((x) => <li key={x}>{x}</li>)}</ul>
                  {tier.id !== 'free' && (open
                    ? <button className="primary" disabled={busy} onClick={() => { setBusy(true); upgrade(tier.id as 'basic' | 'premium', iv); }}>{info.trialAvailable !== false ? b.trial(TRIAL_DAYS) : b.upgrade(b[tier.id])}</button>
                    : <span className="tag neutral">{b.soon}</span>)}
                </div>
              );
            })}
          </div>
          <p className="tiny">{b.trialNote} {b.cancelNote}</p>
        </>
      )}
      {!info.grantUntil && !isIosApp() && (
        <form className="row gap" onSubmit={(e) => { e.preventDefault(); redeemCode(); }}>
          <input className="grow" value={code} onChange={(e) => setCode(e.target.value)} placeholder={b.haveCode} aria-label={b.haveCode} autoCapitalize="characters" />
          <button className="ghost" disabled={busy || !code.trim()}>{b.redeem}</button>
        </form>
      )}
    </section>
  );
}

// ---------------- invite friends ----------------
function InviteCard({ lang }: { lang: Lang }) {
  const v = T[lang].inv;
  const { refresh } = useBill();
  const [st, setSt] = useState<{ code: string; link: string; count: number; months: number; max: number } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { fetch('/api/referral').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { setSt(j); if (j.months) refresh(); } }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st) return null;
  const text = v.shareText(st.link);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };
  const share = async () => { if ((navigator as any).share) await (navigator as any).share({ title: v.shareTitle, text, url: st.link }).catch(() => {}); else copy(); };
  return (
    <section className="card stack invite">
      <div className="label">🎁 {v.title}</div>
      <p className="small">{v.pitch}</p>
      <div className="invlink">{st.link}</div>
      <div className="row gap">
        <button className="primary grow" onClick={share}>{v.share}</button>
        <button className="ghost" onClick={copy}>{copied ? v.copied : v.copy}</button>
      </div>
      <p className="small"><b>{v.stats(st.count, st.months)}</b></p>
      <p className="tiny">{v.rules(st.max)}</p>
    </section>
  );
}

// ---------------- reminders (web push) ----------------
const b64key = (k: string) => { const p = '='.repeat((4 - (k.length % 4)) % 4); const r = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

interface NativeRem { on: boolean; before: number; morning: boolean }
interface NativeProps { phoneOn: boolean; phoneCount: number; setPhoneOn: (v: boolean) => void; rem: NativeRem; setRem: (r: NativeRem) => void }

// Only inside the FateCal app: read the phone's calendar, and reminders that need no server
function NativeCards({ lang, n }: { lang: Lang; n: NativeProps }) {
  const p = T[lang].pc, r = T[lang].rm;
  const [msg, setMsg] = useState('');
  return (
    <>
      <section className="card stack">
        <div className="label">📱 {p.title}</div>
        {n.phoneOn ? (
          <>
            <p className="small"><b>{p.on(n.phoneCount)}</b></p>
            <button className="link danger" onClick={() => n.setPhoneOn(false)}>{p.off}</button>
          </>
        ) : (
          <>
            <p className="small muted">{p.pitch}</p>
            <button className="primary" onClick={async () => { setMsg(''); if (await phoneCalendarAllowed(true)) n.setPhoneOn(true); else setMsg(p.denied); }}>{p.connect}</button>
          </>
        )}
        <p className="tiny">{p.privacy}</p>
      </section>
      <section className="card stack">
        <div className="label">🔔 {r.title}</div>
        {n.rem.on ? (
          <>
            <p className="small"><b>{r.onHere}</b></p>
            <label className="small">{r.before}
              <select value={n.rem.before} onChange={(e) => n.setRem({ ...n.rem, before: Number(e.target.value) })}>
                {[10, 15, 30, 60, 120].map((x) => <option key={x} value={x}>{r.mins(x)}</option>)}
                <option value={0}>{r.none}</option>
              </select>
            </label>
            <label className="row gap small" style={{ alignItems: 'center' }}><input type="checkbox" checked={n.rem.morning} onChange={(e) => n.setRem({ ...n.rem, morning: e.target.checked })} /> {r.morning} · 8:00</label>
            <button className="link danger" onClick={() => n.setRem({ ...n.rem, on: false })}>{r.off}</button>
          </>
        ) : (
          <>
            <p className="small muted">{r.pitch}</p>
            <button className="primary" onClick={async () => { setMsg(''); if (await notificationsAllowed(true)) n.setRem({ ...n.rem, on: true }); else setMsg(r.denied); }}>🔔 {r.on}</button>
          </>
        )}
      </section>
      {msg && <p className="small danger" role="alert">{msg}</p>}
    </>
  );
}

function ReminderCard({ lang }: { lang: Lang }) {
  const r = T[lang].rm;
  const [srv, setSrv] = useState<{ enabled: boolean; key: string | null; prefs: { before: number; morning: boolean; morningHour: number } } | null>(null);
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPhone|iPad|iPod/.test(ua);
  const inApp = /MicroMessenger|FBAN|FBAV|Instagram|Line\//i.test(ua);
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
  const can = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  useEffect(() => {
    fetch('/api/push/subscribe').then((x) => x.json()).then(setSrv).catch(() => {});
    if (can) navigator.serviceWorker.getRegistration('/sw.js').then((reg) => reg?.pushManager.getSubscription()).then((s) => setSub(s ?? null)).catch(() => {});
  }, [can]);
  if (!srv?.enabled) return null;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const save = (body: object) => fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tz, lang, ...body }) }).then((x) => x.json());
  async function turnOn() {
    setBusy(true); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setMsg(r.denied); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64key(srv!.key!) }));
      await save({ subscription: s.toJSON(), prefs: srv!.prefs, test: true });
      setSub(s);
    } catch { setMsg(r.failed); } finally { setBusy(false); }
  }
  async function turnOff() {
    if (!sub) return;
    await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
    setSub(null);
  }
  const setPrefs = (p: Partial<typeof srv.prefs>) => { const prefs = { ...srv.prefs, ...p }; setSrv({ ...srv, prefs }); save({ prefs }); };
  return (
    <section className="card stack">
      <div className="label">🔔 {r.title}</div>
      {sub ? (
        <>
          <p className="small"><b>{r.onHere}</b></p>
          <label className="small">{r.before}
            <select value={srv.prefs.before} onChange={(e) => setPrefs({ before: Number(e.target.value) })}>
              {[10, 15, 30, 60, 120].map((n) => <option key={n} value={n}>{r.mins(n)}</option>)}
              <option value={0}>{r.none}</option>
            </select>
          </label>
          <div className="row gap" style={{ alignItems: 'center' }}>
            <label className="row gap small" style={{ alignItems: 'center' }}><input type="checkbox" checked={srv.prefs.morning} onChange={(e) => setPrefs({ morning: e.target.checked })} /> {r.morning}</label>
            {srv.prefs.morning && <select value={srv.prefs.morningHour} onChange={(e) => setPrefs({ morningHour: Number(e.target.value) })} aria-label={r.at}>
              {[5, 6, 7, 8, 9, 10, 11].map((x) => <option key={x} value={x}>{`${x}:00`}</option>)}
            </select>}
          </div>
          <div className="row gap">
            <button className="ghost" onClick={() => save({ test: true })}>{r.test}</button>
            <button className="link danger" onClick={turnOff}>{r.off}</button>
          </div>
          <p className="tiny">{r.note}</p>
        </>
      ) : inApp ? (
        <p className="small">{r.inApp}</p>
      ) : ios && !standalone ? (
        <>
          <p className="small muted">{r.pitch}</p>
          <p className="small"><b>{r.iosH}</b></p>
          <ol className="small steps">{r.iosSteps.map((x) => <li key={x}>{x}</li>)}</ol>
        </>
      ) : !can ? (
        <p className="small">{r.noSupport}</p>
      ) : (
        <>
          <p className="small muted">{r.pitch}</p>
          <button className="primary" disabled={busy} onClick={turnOn}>🔔 {r.on}</button>
        </>
      )}
      {msg && <p className="small danger" role="alert">{msg}</p>}
    </section>
  );
}

function WhatsAppCard({ lang }: { lang: Lang }) {
  const w = T[lang].wa;
  const [st, setSt] = useState<{ enabled: boolean; number?: string; linked?: string | null } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const load = () => fetch('/api/whatsapp/link').then((r) => r.json()).then(setSt).catch(() => {});
  useEffect(() => { load(); }, []);
  // while a code is showing, check every few seconds whether the person has sent it
  useEffect(() => { if (!code) return; const id = setInterval(load, 4000); return () => clearInterval(id); }, [code]);
  useEffect(() => { if (st?.linked) setCode(null); }, [st?.linked]);
  if (!st?.enabled) return null;
  const msgLink = (c: string) => `https://wa.me/${st.number}?text=${encodeURIComponent(c)}`;
  return (
    <section className="card stack">
      <div className="label">WhatsApp</div>
      {st.linked ? (
        <>
          <p className="small"><b>✓ {w.linked}</b> · {st.linked}</p>
          <p className="small muted">{w.how}</p>
          <div className="row gap">
            <a className="ghost btnlink" href={`https://wa.me/${st.number}`} target="_blank" rel="noopener noreferrer">{w.open}</a>
            <button className="link danger" onClick={async () => { if (confirm(w.unlinkQ)) { await fetch('/api/whatsapp/link', { method: 'DELETE' }); load(); } }}>{w.unlink}</button>
          </div>
        </>
      ) : code ? (
        <>
          <p className="small">{w.sendCode}</p>
          <div className="wacode">{code}</div>
          <a className="primary btnlink" href={msgLink(code)} target="_blank" rel="noopener noreferrer">{w.sendBtn}</a>
          <p className="tiny">{w.waiting}</p>
        </>
      ) : (
        <>
          <p className="small muted">{w.pitch}</p>
          <button className="primary" onClick={async () => { const j = await fetch('/api/whatsapp/link', { method: 'POST' }).then((r) => r.json()).catch(() => null); if (j?.code) setCode(j.code); }}>{w.connect}</button>
        </>
      )}
    </section>
  );
}

interface GcalState { email?: string; events: CalEvent[]; at: string }

function GcalCard({ lang, gcal, note, onConnect, onRefresh, onDisconnect }: { lang: Lang; gcal: GcalState | null; note: string; onConnect: () => void; onRefresh: () => Promise<boolean>; onDisconnect: () => Promise<void> }) {
  const g = T[lang].gc;
  const [busy, setBusy] = useState(false);
  const msg = note === 'declined' ? g.declined : note === 'noscope' ? g.noScope : note === 'error' ? g.failed : '';
  if (!gcal) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <button className="social" onClick={onConnect}><ProviderIcon id="google" /> {g.connect}</button>
        <p className="tiny">{g.readOnly}</p>
        {msg && <p className="small danger" role="alert">{msg}</p>}
      </div>
    );
  }
  const upcoming = gcal.events.filter((e) => new Date(e.end) >= new Date()).length;
  return (
    <div className="suggest">
      <p className="small"><b>✓ {g.connected}</b>{gcal.email ? ` · ${gcal.email}` : ''}</p>
      <p className="small muted" aria-live="polite">{g.count(upcoming)}</p>
      <div className="row gap">
        <button className="ghost" disabled={busy} onClick={async () => { setBusy(true); await onRefresh(); setBusy(false); }}>{busy ? T[lang].syncing : g.refresh}</button>
        <button className="link danger" onClick={async () => { if (confirm(g.disconnectConfirm)) await onDisconnect(); }}>{g.disconnect}</button>
      </div>
    </div>
  );
}

// ---------------- account ----------------

interface Account { name?: string; email?: string; image?: string }

function ProviderIcon({ id }: { id: string }) {
  if (id === 'google') return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>;
}

function AccountCard({ lang, account, providers, compact = false }: { lang: Lang; account: Account | null; providers: string[]; compact?: boolean }) {
  const t = T[lang];
  if (account) {
    return (
      <section className="card row gap">
        {account.image ? <img className="avatar" src={account.image} alt="" /> : null}
        <div className="grow">
          <div className="ev-title">{account.name || account.email}</div>
          <div className="small muted">{t.signedInNote}</div>
        </div>
        {!compact && <button className="ghost" onClick={() => { Object.values(K).filter((k) => k !== K.langPick).forEach((k) => localStorage.removeItem(k)); signOut({ redirectTo: '/' }); }}>{t.signOut}</button>}
      </section>
    );
  }
  if (!providers.length) return null;
  return (
    <section className={compact ? 'stack' : 'card stack'}>
      {!compact && <div className="label">{t.account}</div>}
      {providers.map((p) => (
        <button key={p} className="social" onClick={() => { markRegistrationPending(); signIn(p, { redirectTo: '/' }); }}>
          <ProviderIcon id={p} /> {p === 'google' ? t.withGoogle : t.withFacebook}
        </button>
      ))}
      <p className="small muted">{compact ? t.orNoAccount : t.signInWhy}</p>
    </section>
  );
}

// ---------------- email forwarding ----------------

const KIND_CAT: Record<string, Category> = { meeting: 'meeting', order: 'money', travel: 'travel', bill: 'money', contract: 'signing', other: 'general' };

function MailSection({ lang, chart, mail, mailAddr, usage, onEnable, onCheck, onClear }: { lang: Lang; chart: Chart; mail: MailItem[]; mailAddr: string | null; usage: { used: number; limit: number } | null; onEnable: () => Promise<void>; onCheck: () => Promise<number>; onClear: () => void }) {
  const t = T[lang];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const verify = [...mail].reverse().find((m) => m.kind === 'verify');
  const recent = mail.filter((m) => m.kind !== 'verify' && m.kind !== 'limit').slice(-8).reverse();
  // a limit notice only matters in the month it arrived
  const thisMonth = new Date().toISOString().slice(0, 7);
  const limitHit = mail.some((m) => m.kind === 'limit' && m.receivedAt.slice(0, 7) === thisMonth) || (!!usage && usage.used > usage.limit);
  if (!useBill().info.limits.mailForwarding) return (
    <section className="card"><div className="label">{t.forwarding}</div><Locked lang={lang} text={t.bill.lockedMail} /></section>
  );
  return (
    <section className="card form">
      <div className="label">{t.forwarding}</div>
      {!mailAddr ? (
        <>
          <p className="muted small">{t.forwardingIntro}</p>
          <button className="primary" disabled={busy} onClick={async () => { setBusy(true); await onEnable(); setBusy(false); }}>{t.getAddress}</button>
        </>
      ) : (
        <>
          <p className="small">{t.yourAddress}</p>
          <div className="row gap">
            <code className="addr grow">{mailAddr}</code>
            <button className="ghost" onClick={() => { navigator.clipboard?.writeText(mailAddr); setCopied(true); }}>{copied ? t.copied : t.copy}</button>
          </div>
          <details className="explain"><summary>{t.howForward}</summary><ul className="reasons">{t.forwardSteps.map((x) => <li key={x}>{x}</li>)}</ul></details>
          {usage && <p className="tiny" aria-live="polite">{t.mailUsage(Math.min(usage.used, usage.limit), usage.limit)}</p>}
          {limitHit && usage && <p className="small danger" role="alert">{t.limitHit(usage.limit)}</p>}
          {verify && (
            <div className="suggest">
              <p className="small"><b>{t.gmailConfirm}</b> {verify.verifyCode ? `${t.code}: ${verify.verifyCode}` : ''}</p>
              {verify.verifyLink && <a className="primary btnlink" href={verify.verifyLink} target="_blank" rel="noreferrer">{t.openConfirm}</a>}
            </div>
          )}
          <div className="row gap">
            <button className="ghost grow" disabled={busy} onClick={async () => { setBusy(true); const n = await onCheck(); setNote(n < 0 ? t.mailError : n ? `${n} ${t.newMail}` : t.noNewMail); setBusy(false); }}>{busy ? t.syncing : t.checkMail}</button>
            {recent.length > 0 && <button className="link" onClick={onClear}>{t.clearMail}</button>}
          </div>
          {note && <p className="small muted" aria-live="polite">{note}</p>}
          {recent.map((m) => {
            const ev = mailToEvent(m);
            const r = ev ? readEvent(chart, { ...ev, title: `${m.title}` }, []) : null;
            const cat = KIND_CAT[m.kind] ?? 'general';
            return (
              <div key={m.id} className="mail">
                <div className="row gap top-align">
                  <div className="grow">
                    <div className="ev-title">{m.title}</div>
                    <div className="muted small">{m.from}{m.amount ? ` · ${m.amount}` : ''}{ev ? ` · ${fmtDay(new Date(ev.start), lang)}${ev.allDay ? '' : ' ' + fmtTime(ev.start, lang)}` : ''}</div>
                    {r && <div className="small">{cat !== 'general' ? `${activityName(cat, lang)}: ` : ''}{r.reasons.filter((x) => x.scope !== 'hour' || !ev?.allDay).slice(0, 1).map((x) => reasonText(x, lang))}</div>}
                    {!r && m.summary && <div className="small muted">{m.summary}</div>}
                  </div>
                  {r && <VerdictTag v={r.verdict} lang={lang} />}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

// ---------------- icons ----------------

function Icon({ name }: { name: Tab }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'today') return <svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>;
  if (name === 'ask') return <svg {...p}><path d="M4 5.5h16v10H9l-5 4z" /></svg>;
  if (name === 'home') return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 5.5l2 6.5-2 6.5-2-6.5z" /><path d="M12 3.5v1.5M12 19v1.5M3.5 12H5M19 12h1.5" /></svg>;
  if (name === 'chart') return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a4.25 4.25 0 0 1 0 8.5a4.25 4.25 0 0 0 0 8.5" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>;
}

// The device's preferred language: the first of the person's languages that FateCal speaks.
function deviceLang(): Lang {
  const list = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean);
  for (const x of list) { const p = x.toLowerCase().slice(0, 2); if (p === 'zh') return 'zh'; if (p === 'es') return 'es'; if (p === 'en') return 'en'; }
  return 'en';
}
