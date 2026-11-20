'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BirthInput, CalEvent, Category, Chart, computeChart, readEvent, scoreDay, dayActivities, activityName, STEM, BRANCH, ELEMENT_NAME, Element, HIDDEN,
} from '@/lib/engine';
import { T, Lang, almanac } from '@/lib/i18n';
import { buildContext, fallbackAnswer, fmtDay, fmtHour } from '@/lib/bot';
import Footer from '@/components/Footer';
import { signIn, signOut } from 'next-auth/react';
import ShoppingResources from '@/components/ShoppingResources';
import { CONTACT_EMAIL, ACCOUNTS_ON } from '@/lib/site';
import type { MailItem } from '@/lib/mail';
import { Sex, Dir, DIRS, DIR_NAME, DIR_ELEMENT, STAR8, FLY, kuaOf, annualStars, liChunYear, yearGanZhi, readHome, dirFromDegrees } from '@/lib/fengshui';

interface Profile { name: string; birth: BirthInput; place: string; sex?: Sex }
type Tab = 'today' | 'ask' | 'home' | 'chart' | 'settings';
type Pic = { media_type: string; data: string; preview: string };
interface Seed { q: string; photo?: Pic }
// the Li Chun year of birth, which feng shui uses (births before about Feb 4 count as the previous year)
const birthFsYear = (b: BirthInput) => liChunYear(new Date(b.year, b.month - 1, b.day, b.hourUnknown ? 12 : b.hour, b.hourUnknown ? 0 : b.minute));
interface Msg { role: 'user' | 'assistant'; text: string; image?: string }

const K = { owner: 'fatecal.owner', profile: 'fatecal.profile', events: 'fatecal.events', ics: 'fatecal.ics', lang: 'fatecal.lang', mailKey: 'fatecal.mailkey', mailAddr: 'fatecal.mailaddr', mail: 'fatecal.mail' };

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const tLocale = (lang: Lang) => (lang === 'zh' ? 'zh-CN' : 'en-US');
const fmtTime = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(tLocale(lang), { hour: 'numeric', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');
const isoLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" are local wall times; anything with an offset is absolute.
const parseMailTime = (v: string) => (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? new Date(v) : new Date(v.length === 10 ? `${v}T00:00` : v));
const mailToEvent = (m: MailItem): CalEvent | null => {
  if (!m.start || m.kind === 'verify' || m.kind === 'limit') return null;
  const s = parseMailTime(m.start);
  if (isNaN(s.getTime())) return null;
  const allDay = !!m.allDay || m.start.length === 10;
  const e = m.end ? parseMailTime(m.end) : new Date(s.getTime() + (allDay ? 24 : 1) * 3600e3);
  return { id: `mail-${m.id}`, title: m.title, start: s.toISOString(), end: (isNaN(e.getTime()) ? new Date(s.getTime() + 3600e3) : e).toISOString(), allDay, source: 'email', from: m.from };
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
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
  const [mailUsage, setMailUsage] = useState<{ used: number; limit: number } | null>(null);
  const [authed, setAuthed] = useState<'checking' | 'out' | 'in'>('checking');
  const synced = useRef(false);

  useEffect(() => {
    const stored = load<Lang | null>(K.lang, null);
    setLang(stored ?? (navigator.language?.startsWith('zh') ? 'zh' : 'en'));
    setProfile(load<Profile | null>(K.profile, null));
    setManual(load<CalEvent[]>(K.events, []));
    setIcs(load(K.ics, null));
    setMail(load<MailItem[]>(K.mail, []));
    setMailKey(load<string | null>(K.mailKey, null));
    setMailAddr(load<string | null>(K.mailAddr, null));
    setReady(true);
  }, []);
  useEffect(() => { if (ready) save(K.lang, lang); }, [lang, ready]);
  useEffect(() => { if (ready) save(K.events, manual); }, [manual, ready]);
  useEffect(() => { if (ready) save(K.ics, ics); }, [ics, ready]);
  useEffect(() => { if (ready) save(K.mail, mail.slice(-200)); }, [mail, ready]);

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
      if (d?.profile) {
        setProfile(d.profile); save(K.profile, d.profile);
        if (Array.isArray(d.events)) setManual(d.events);
        if (d.icsUrl && !ics?.url) setIcs({ url: d.icsUrl, events: [] });
        if (d.lang) setLang(d.lang);
        if (d.mailKey && !mailKey) { save(K.mailKey, d.mailKey); setMailKey(d.mailKey); }
      }
      synced.current = true;
      setAuthed('in');
    }).catch(() => { synced.current = true; setAuthed('out'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    if (!ready || !account || !synced.current || !profile) return;
    const id = setTimeout(() => {
      fetch('/api/sync', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), profile, events: manual, icsUrl: ics?.url ?? null, lang, mailKey }) }).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [ready, account, profile, manual, ics?.url, lang, mailKey]);

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
  const events = useMemo(() => [...manual, ...(ics?.events ?? []), ...(mail.map(mailToEvent).filter(Boolean) as CalEvent[])].sort((a, b) => a.start.localeCompare(b.start)), [manual, ics, mail]);
  const t = T[lang];

  // Before local data loads (and on the server) show the onboarding screen, so the page has real content for search engines.
  // Everyone signs up first (Google, Facebook, email or phone), then fills in their birth details.
  if (!ready) return <div className="preload"><Landing lang={lang} setLang={setLang} providers={[]} onDone={() => {}} /></div>;
  if (!ACCOUNTS_ON && (!profile || !chart)) return <Landing lang={lang} setLang={setLang} providers={[]} onDone={(p) => { setProfile(p); save(K.profile, p); }} />;
  if (ACCOUNTS_ON && authed === 'checking') return <div className="shell onboard"><div className="hero"><Logo big /><p className="muted" aria-live="polite">{t.loading}</p></div></div>;
  if (ACCOUNTS_ON && authed === 'out') return <Landing lang={lang} setLang={setLang} providers={providers} onDone={() => {}} />;
  if (!profile || !chart) {
    return <Onboarding lang={lang} setLang={setLang} initial={null} account={account} onDone={(p) => { setProfile(p); save(K.profile, p); }} />;
  }

  const v2 = t.v2;
  return (
    <div className="desk">
    <aside className="desk-side">
      <Logo big />
      <h1>{v2.deskH1a} <em>{v2.deskEm}</em> {v2.deskH1b}</h1>
      <p className="lead">{v2.deskLead}</p>
      <ul>{v2.deskPts.map(([em, h, p]) => <li key={h}>{em} <b>{h}</b>: {p}</li>)}</ul>
      <Footer lang={lang} />
    </aside>
    <div className="shell">
      <header className="top">
        <Logo />
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} aria-label="Switch language">{lang === 'en' ? '中文' : 'EN'}</button>
      </header>
      <main className="main">
        {tab === 'today' && <Today lang={lang} chart={chart} events={events} manual={manual} setManual={setManual} name={profile.name} />}
        {tab === 'ask' && <Ask lang={lang} chart={chart} events={events} profile={profile} seed={seed} clearSeed={() => setSeed(null)} />}
        {tab === 'home' && <FengShui lang={lang} chart={chart} profile={profile} setSex={(sx) => { const p = { ...profile, sex: sx }; setProfile(p); save(K.profile, p); }} ask={(sd) => { setSeed(sd); setTab('ask'); }} />}
        {tab === 'chart' && <ChartView lang={lang} chart={chart} profile={profile} onEdit={(p) => { setProfile(p); save(K.profile, p); }} />}
        {tab === 'settings' && (
          <Settings lang={lang} setLang={setLang} ics={ics} setIcs={setIcs} chart={chart} account={account} providers={providers}
            mail={mail} mailAddr={mailAddr} mailUsage={mailUsage} onEnableMail={enableMail} onCheckMail={() => checkMail()} onClearMail={() => setMail([])}
            onReset={() => { if (confirm(t.resetConfirm)) { Object.values(K).forEach((k) => localStorage.removeItem(k)); location.reload(); } }} />
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
      {!initial && (
        <div className="hero">
          <Logo big />
          <h1>{t.welcome}{account?.name && !account.name.includes('@') && !account.name.includes('*') ? `, ${account.name}` : ''}</h1>
          <p className="muted">{t.profileIntro}</p>
          <div className="seg">
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
            <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button>
          </div>
        </div>
      )}
      {form()}
      <p className="muted small pad">{t.simplified}</p>
      {!initial && <Footer lang={lang} />}
    </div>
  );
}

// ---------------- landing and sign-up ----------------

function Logo({ big = false }: { big?: boolean }) {
  return <img className={big ? 'logo big' : 'logo'} src="/logo.svg" alt="FateCal" width={big ? 172 : 115} height={big ? 42 : 28} />;
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
        <Logo />
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} aria-label="Switch language">{lang === 'en' ? '中文' : 'EN'}</button>
      </header>
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

      <section id="start" className="startform">
        <h2 className="display sm">{l.formH}</h2>
        <p className="small muted">{l.formP}</p>
        <div className="seg">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button>
        </div>
      </section>
      {ACCOUNTS_ON ? <SignUp lang={lang} providers={providers} /> : <Onboarding lang={lang} setLang={setLang} initial={null} onDone={onDone} embedded />}
      <p className="muted small pad">{t.simplified}</p>
      <Footer lang={lang} />
    </div>
  );
}

const DIAL = ['+1', '+86', '+852', '+853', '+886', '+65', '+60', '+81', '+82', '+44', '+61', '+64', '+33', '+49', '+52'];

function SignUp({ lang, providers }: { lang: Lang; providers: string[] }) {
  const t = T[lang];
  const [mode, setMode] = useState<'pick' | 'email' | 'phone'>('pick');
  const [step, setStep] = useState<'enter' | 'code'>('enter');
  const [email, setEmail] = useState('');
  const [dial, setDial] = useState(lang === 'zh' ? '+86' : '+1');
  const [num, setNum] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const to = mode === 'email' ? email.trim() : `${dial}${num.replace(/[^\d]/g, '').replace(/^0+/, '')}`;
  const social = providers.filter((p) => p === 'google' || p === 'facebook');

  async function send() {
    setErr('');
    if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setErr(t.badEmail); return; }
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
            <button key={p} className="social" onClick={() => signIn(p, { redirectTo: '/' })}>
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
            <label>{t.emailLabel}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required autoFocus /></label>
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
      <p className="tiny muted">{t.agree} <a href="/terms">{lang === 'zh' ? '服务条款' : 'Terms'}</a> {t.and} <a href="/privacy">{lang === 'zh' ? '隐私政策' : 'Privacy Policy'}</a>.</p>
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
const shortHour = (h: number, lang: Lang) => (lang === 'zh' ? `${h % 24}点` : `${((h + 11) % 12) + 1}${h % 24 < 12 ? 'a' : 'p'}`);

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

function Today({ lang, chart, events, manual, setManual, name }: { lang: Lang; chart: Chart; events: CalEvent[]; manual: CalEvent[]; setManual: (e: CalEvent[]) => void; name: string }) {
  const t = T[lang];
  const v = t.v2;
  const [day, setDay] = useState(() => new Date());
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const summary = useMemo(() => scoreDay(chart, day), [chart, day]);
  const acts = useMemo(() => dayActivities(chart, day), [chart, day]);
  const [trad, setTrad] = useState(false);
  const sep = lang === 'zh' ? '、' : ', ';
  const todays = events.filter((e) => sameDay(new Date(e.start), day)).sort((a, b) => a.start.localeCompare(b.start));
  const shift = (n: number) => setDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + n));
  const isToday = sameDay(day, new Date());
  const hr = new Date().getHours();
  const hi = v.hi[hr < 12 ? 0 : hr < 18 ? 1 : 2];
  const gz = summary.ganZhi;
  const gzName = lang === 'zh' ? `${ELEMENT_NAME[STEM[gz[0]].el].zh}${BRANCH[gz[1]].zh}日` : `${ELEMENT_NAME[STEM[gz[0]].el].en} ${BRANCH[gz[1]].animal} day · ${STEM[gz[0]].pinyin}-${BRANCH[gz[1]].pinyin}`;
  const dateStr = day.toLocaleDateString(tLocale(lang), { month: lang === 'zh' ? 'long' : 'short', day: 'numeric' });
  const best = summary.bestHours[0];
  const hs = summary.hours.map((h) => h.score);
  const lo = Math.min(...hs), hiS = Math.max(...hs);
  const top2 = [...summary.hours].sort((a, b) => b.score - a.score).slice(0, 2).map((h) => h.start);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  return (
    <div className="stack">
      <div className="greet">{hi}{name ? (lang === 'zh' ? `，${name}` : `, ${name}`) : ''} 👋</div>
      <div className="daynav">
        <button className="icon" onClick={() => shift(-1)} aria-label={t.prevDay}>‹</button>
        <div className="dayhead">
          <h1>{isToday ? `${v.todayIs} · ${dateStr}` : fmtDay(day, lang)}</h1>
          <div className="gzline"><span className="han">{gz}</span>{gzName}</div>
        </div>
        <button className="icon" onClick={() => shift(1)} aria-label={t.nextDay}>›</button>
      </div>

      <section className="herocard">
        <ScoreRing score={summary.score} label={t.dayScore} />
        <div className="grow">
          <span className={`vpill ${summary.verdict}`}><i />{t[summary.verdict]}</span>
          <h2>{t.verdictLine[summary.verdict]}</h2>
          {best && <p>{v.window(fmtHour(best.start, lang), fmtHour(best.start + 2, lang))}</p>}
          <button className="link light" onClick={() => setTrad(!trad)} aria-expanded={trad}>{trad ? t.hideAlmanac : t.showAlmanac}</button>
          {trad && (
            <div className="trad">
              <p><b>{lang === 'zh' ? '宜' : 'Almanac yi'}:</b> {summary.yi.map((w) => almanac(w, lang)).join(sep)}</p>
              <p><b>{lang === 'zh' ? '忌' : 'Almanac ji'}:</b> {summary.ji.map((w) => almanac(w, lang)).join(sep)}</p>
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
          <div className="label">{v.whyToday}</div>
          <ul className="whyday">
            {summary.reasons.map((r, i) => <li key={i}><span className={`em ${r.delta >= 0 ? 'p' : 'm'}`}>{r.delta >= 0 ? '↑' : '↓'}</span><span>{lang === 'zh' ? r.zh : r.en}</span></li>)}
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
          onMove={(s, en) => { setManual(manual.map((m) => (m.id === e.id ? { ...m, start: s, end: en } : m))); flash(v.movedToast); }}
          onDelete={() => setManual(manual.filter((m) => m.id !== e.id))} />
      ))}
      <button className="addbig" onClick={() => setAdding(true)}>+ {v.addOrConnect}</button>
      {adding && <AddEvent lang={lang} day={day} onSave={(e) => { setManual([...manual, e]); setAdding(false); }} onCancel={() => setAdding(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      <ShoppingResources lang={lang} />
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
  const week = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const title = first.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
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
                aria-label={`${new Date(y, m, d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric' })}, ${t[verdicts[d - 1]]}${counts[d] ? `, ${counts[d]} ${t.eventsWord}` : ''}`}>
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

function AddEvent({ lang, day, onSave, onCancel }: { lang: Lang; day: Date; onSave: (e: CalEvent) => void; onCancel: () => void }) {
  const t = T[lang];
  const v = t.v2;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('');
  const [date, setDate] = useState(isoLocalDate(day));
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('15:00');
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
        onSave({ id: `m${Date.now()}`, title: title.trim(), start: s.toISOString(), end: en.toISOString(), source: 'manual' });
      }}>
        <span className="grab" aria-hidden="true" />
        <h3 id="sheet-h">{v.newEvent}</h3>
        <div className="quick">
          {v.quick.map(([em, k]) => (
            <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setTitle(v.quickTitle[k]); }}>{em} {k}</button>
          ))}
        </div>
        <label>{t.title}<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === 'zh' ? '和张总谈合作' : 'Partnership talk with Mr. Zhang'} required autoFocus /></label>
        <label>{t.date}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="row gap">
          <label className="grow">{t.from}<input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="grow">{t.to}<input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
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
  const actLabel = r.category === 'general' ? '' : (lang === 'zh' ? `${activityName(r.category, lang)}：` : `For ${activityName(r.category, lang)}: `);
  const alt = r.alternatives[0];
  const sameD = alt ? sameDay(new Date(alt.start), new Date(ev.start)) : false;
  const altLabel = alt ? `${sameD ? '' : fmtDay(new Date(alt.start), lang) + ' '}${fmtTime(alt.start, lang)}` : '';
  const note = alt
    ? lang === 'zh'
      ? `您好，「${ev.title}」原定 ${fmtDay(new Date(ev.start), lang)} ${fmtTime(ev.start, lang)}，可否改到 ${fmtDay(new Date(alt.start), lang)} ${fmtTime(alt.start, lang)}？谢谢！`
      : `Hi! Could we move "${ev.title}" from ${fmtDay(new Date(ev.start), lang)} ${fmtTime(ev.start, lang)} to ${fmtDay(new Date(alt.start), lang)} ${fmtTime(alt.start, lang)}? Thanks!`
    : '';
  const st = new Date(ev.start);
  const tb = ev.allDay
    ? { a: lang === 'zh' ? '全天' : 'All', b: lang === 'zh' ? '' : 'day' }
    : lang === 'zh'
      ? { a: `${st.getHours()}:${pad(st.getMinutes())}`, b: st.getHours() < 12 ? '上午' : '下午' }
      : { a: `${((st.getHours() + 11) % 12) + 1}:${pad(st.getMinutes())}`, b: st.getHours() < 12 ? 'AM' : 'PM' };
  const showMove = !ev.allDay && !!alt && r.verdict !== 'good';

  return (
    <article className={`card event ${r.verdict === 'bad' ? 'warn' : ''}`}>
      <div className="row gap top-align">
        <div className="tblock"><b>{tb.a}</b><span>{tb.b}</span></div>
        <div className="grow">
          <div className="row between top-align gap">
            <div className="ev-title">{ev.title}</div>
            <span className={`vscore ${r.verdict}`}>{t[r.verdict]} {r.score}</span>
          </div>
          {tops.length > 0 && <div className="evline">{actLabel}{tops.map((x) => (lang === 'zh' ? x.zh : x.en)).join(' ')}</div>}
          {!ev.allDay && r.verdict === 'good' && alt && <div className="evline">{t.evenBetter} <b>{altLabel}</b> ({alt.score})</div>}
          {!ev.allDay && r.verdict === 'bad' && !alt && <div className="evline">{t.noBetter}</div>}
        </div>
      </div>
      <div className="evactions">
        {showMove && (ev.source === 'manual'
          ? <button className="primary" onClick={() => onMove(alt.start, alt.end)}>⇢ {sameD ? v.moveTo : v.tryDay} {altLabel} ({alt.score})</button>
          : <button className="primary" onClick={() => { navigator.clipboard?.writeText(note); setCopied(true); }}>{copied ? t.copied : `${t.copyNote} · ${altLabel}`}</button>)}
        <button className="softbtn" onClick={() => setWhy(!why)} aria-expanded={why}>{why ? t.hide : t.why}</button>
        {ev.source === 'manual' && <button className="link danger" onClick={onDelete}>{t.del}</button>}
      </div>
      {showMove && ev.source !== 'manual' && <p className="tiny">{t.calendarNote}</p>}
      {why && (
        <div className="whybox">
          <ul>
            {r.reasons.map((x, i) => <li key={i}><span className={x.delta >= 0 ? 'plus' : 'minus'}>{x.delta >= 0 ? '+' : ''}{x.delta}</span> {lang === 'zh' ? x.zh : x.en}</li>)}
          </ul>
          <p className="tiny" style={{ marginTop: 6 }}>{lang === 'zh' ? `综合 ${r.score} 分 · 日 ${r.dayGanZhi} · 时 ${r.hourGanZhi}` : `Score ${r.score} · ${STEM[r.dayGanZhi[0]].pinyin}-${BRANCH[r.dayGanZhi[1]].pinyin} day · ${BRANCH[r.hourGanZhi[1]].animal} hour`}</p>
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
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
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
    rec.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
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
    setMsgs([...history, { role: 'user', text: question || (lang === 'zh' ? '帮我看看这张图' : 'What about this photo?'), image: pic?.preview }, { role: 'assistant', text: '' }]);
    setQ('');
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
          question, lang, history: history.map(({ role, text }) => ({ role, text })),
          context: buildContext(chart, events, question, lang, { birthYear: birthFsYear(profile.birth), sex: profile.sex }),
          image: pic ? { media_type: pic.media_type, data: pic.data } : undefined,
        }),
      });
      if (res.status === 503) fallback(t.offline);
      else if (res.status === 429) put(t.rateLimited);
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
        <h1>{t.askTitle}</h1>
        <p className="muted">{t.askHint}</p>
      </div>
      <div className="msgs">
        {msgs.map((m, i) => (m.text || m.image ? (
          <div key={i} className={`bubble ${m.role}`}>
            {m.image && <img className="shot" src={m.image} alt={t.photoAlt} />}
            {m.text}
            {m.role === 'assistant' && !(busy && i === msgs.length - 1) && (
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
          <button className="example" onClick={() => fileRef.current?.click()}>📷 {t.photoExample}</button>
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
        <button type="button" className="iconbtn" onClick={() => fileRef.current?.click()} aria-label={t.addPhoto} disabled={busy}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2.5" /><circle cx="12" cy="12.5" r="3.5" /><path d="M8.5 5l1.5-2h4l1.5 2" /></svg>
        </button>
        {voiceOk && (
          <button type="button" className={`iconbtn ${listening ? 'live' : ''}`} onClick={toggleVoice} aria-label={listening ? t.stopVoice : t.voice} aria-pressed={listening} disabled={busy}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
          </button>
        )}
        <label className="sr" htmlFor="q">{t.askTitle}</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? t.listening : photo ? t.photoPlaceholder : t.askPlaceholder} maxLength={500} />
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
  const zh = lang === 'zh';
  const dn = (d: Dir) => (zh ? DIR_NAME[d].zh : DIR_NAME[d].en);
  const el = (e: Element) => (zh ? ELEMENT_NAME[e].zh : ELEMENT_NAME[e].en);
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
            <p><b>{f.gua}:</b> {kua.number} {zh ? kua.trigram.zh : kua.trigram.en} · {kua.group === 'east' ? f.eastGroup : f.westGroup}</p>
            <div className="small"><b>{f.goodDirs}</b></div>
            <ul className="reasons">
              {kua.dirs.filter((d) => STAR8[d.star].good).map((d) => (
                <li key={d.star}><span className="plus">{dn(d.dir)}</span> {zh ? STAR8[d.star].zh : STAR8[d.star].en}: {zh ? STAR8[d.star].useZh : STAR8[d.star].useEn}</li>
              ))}
            </ul>
            <div className="small"><b>{f.badDirs}</b></div>
            <ul className="reasons">
              {kua.dirs.filter((d) => !STAR8[d.star].good).map((d) => (
                <li key={d.star}><span className="minus">{dn(d.dir)}</span> {zh ? STAR8[d.star].zh : STAR8[d.star].en}: {zh ? STAR8[d.star].useZh : STAR8[d.star].useEn}</li>
              ))}
            </ul>
            <p className="small muted">{f.dirsHow}</p>
          </>
        )}
        <p className="small"><b>{f.elDirs}:</b> {DIRS.filter((d) => chart.favorable.includes(DIR_ELEMENT[d])).map((d) => `${dn(d)} (${el(DIR_ELEMENT[d])})`).join(zh ? '、' : ', ')}</p>
      </section>

      <section className="card">
        <div className="row between">
          <div className="label">{f.stars}</div>
          <div className="seg sm">
            <button className={yr === thisYear ? 'on' : ''} onClick={() => { setYr(thisYear); setCell(null); }}>{thisYear}</button>
            <button className={yr === thisYear + 1 ? 'on' : ''} onClick={() => { setYr(thisYear + 1); setCell(null); }}>{thisYear + 1}</button>
          </div>
        </div>
        <p className="small muted">{f.starsIntro} {zh ? `${yr}年 ${yearGanZhi(yr)}，` : `${yr} (${yearGanZhi(yr)}), `}{f.starsFrom}</p>
        <div className="fsgrid" role="grid">
          {GRID.map((g) => {
            const st = FLY[stars[g]];
            return (
              <button key={g} role="gridcell" className={`fscell ${st.tone} ${cell === g ? 'sel' : ''}`} onClick={() => setCell(cell === g ? null : g)} aria-pressed={cell === g}
                aria-label={`${g === 'C' ? f.center : dn(g)}: ${zh ? st.zh : st.en}, ${zh ? st.zh2 : st.en2}`}>
                <span className="tiny">{g === 'C' ? f.center : dn(g)}</span>
                <b>{stars[g]}</b>
                <span className="tiny">{zh ? st.zh.split(' ')[1] : st.en2.split(/[ ,:]/)[0]}</span>
              </button>
            );
          })}
        </div>
        {!c ? <p className="small muted">{f.tapCell}</p> : (
          <div className="suggest">
            <p className="small"><b>{cell === 'C' ? f.center : dn(cell as Dir)} · {zh ? c.zh : c.en}</b>: {zh ? c.zh2 : c.en2}</p>
            <p className="small">{zh ? c.fixZh : c.fixEn}</p>
            {c.query && <a className="link shopping-link" href={amazon(c.query)} target="_blank" rel="sponsored nofollow noopener noreferrer">{f.shop}</a>}
            {c.query && <p className="tiny muted">{f.shopNote}</p>}
          </div>
        )}
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
            <ul className="reasons">{home.notes.map((n, i) => <li key={i}>{zh ? n.zh : n.en}</li>)}</ul>
            {FLY[home.doorStarThisYear].query && FLY[home.doorStarThisYear].tone === 'bad' && (
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
        <button className="primary" onClick={() => fileRef.current?.click()}>{f.photoBtn}</button>
        <button className="ghost" onClick={() => ask({ q: f.askMoreQ })}>{f.askMore}</button>
      </section>
      <p className="muted small">{f.note}</p>
    </div>
  );
}

// ---------------- chart ----------------

const ZODIAC_EMOJI: Record<string, string> = { 子: '🐭', 丑: '🐮', 寅: '🐯', 卯: '🐰', 辰: '🐲', 巳: '🐍', 午: '🐴', 未: '🐑', 申: '🐵', 酉: '🐔', 戌: '🐶', 亥: '🐷' };
const DM_LINE: Record<string, { en: string; zh: string }> = {
  甲: { en: 'Like a tall tree: upright, steady, always growing toward a goal.', zh: '像参天大树：正直、稳当，总是一路往上长。' },
  乙: { en: 'Like vines and flowers: flexible, easy to be around, always finds a way.', zh: '像花草藤蔓：灵活、好相处，总能找到出路。' },
  丙: { en: 'Like the sun: warm, open and generous; you light up a room.', zh: '像太阳：热情大方，走到哪儿亮到哪儿。' },
  丁: { en: 'Like candlelight: thoughtful, warm, focused on what matters.', zh: '像烛光：细腻、温暖，专注在要紧的事上。' },
  戊: { en: 'Like a mountain: reliable and calm; people feel safe around you.', zh: '像大山：可靠、沉稳，让人有安全感。' },
  己: { en: 'Like garden soil: nurturing, practical and patient.', zh: '像田园沃土：会照顾人，务实、有耐心。' },
  庚: { en: 'Like a blade: decisive and principled.', zh: '像一把刀：果断、讲原则。' },
  辛: { en: 'Like fine jewelry: refined, precise, with an eye for quality.', zh: '像珠宝：精致、讲究，眼光高。' },
  壬: { en: 'Like a great river: big-picture, adaptable, always moving.', zh: '像江河：眼界大、会变通，停不下来。' },
  癸: { en: 'Like rain and dew: intuitive, gentle and quietly persistent.', zh: '像雨露：直觉强、温柔，默默坚持。' },
};
const ELS: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
const EL_HAN: Record<Element, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

function ChartView({ lang, chart, profile, onEdit }: { lang: Lang; chart: Chart; profile: Profile; onEdit: (p: Profile) => void }) {
  const t = T[lang];
  const v = t.v2;
  const [editing, setEditing] = useState(false);
  if (editing) return <Onboarding lang={lang} setLang={() => {}} initial={profile} onDone={(p) => { onEdit(p); setEditing(false); }} onCancel={() => setEditing(false)} />;
  const zh = lang === 'zh';
  const el = (e: Element) => (zh ? ELEMENT_NAME[e].zh : ELEMENT_NAME[e].en);
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
  return (
    <div className="stack">
      <h1>{t.myChart}</h1>
      <section className="card profcard">
        <div className="zav" aria-hidden="true">{ZODIAC_EMOJI[chart.yearBranch]}</div>
        <div className="grow">
          <b>{profile.name || (zh ? '我' : 'Me')}</b>
          <div className="small muted">{bornStr}{profile.place ? ` · ${profile.place}` : ''}</div>
          <div className="tiny">{zh ? `属${BRANCH[chart.yearBranch].zh} · ${chart.sunSign.zh}` : `${BRANCH[chart.yearBranch].animal} · ${chart.sunSign.en}`} · {t.clockTimeNote}</div>
        </div>
      </section>

      <div className="sechead"><h3>{zh ? '你的四柱' : 'Your four pillars'}</h3><span className="tiny">{zh ? '上：天干 · 下：地支' : 'top: stem · bottom: branch'}</span></div>
      <div className="pillars">
        {chart.pillars.map((p) => {
          const hidden = p.label === 'hour' && chart.hourUnknown;
          return (
            <div key={p.label} className={`pillar ${p.label === 'day' ? 'dm' : ''}`}>
              <div className="k">{t[p.label]}{p.label === 'day' ? ` · ${v.you}` : ''}</div>
              <div className="gz">{hidden ? '?' : p.stem}<br />{hidden ? '?' : p.branch}</div>
              {!hidden && <div className="elan">{zh ? `${ELEMENT_NAME[STEM[p.stem].el].zh}${BRANCH[p.branch].zh}` : `${ELEMENT_NAME[STEM[p.stem].el].en} ${BRANCH[p.branch].animal}`}</div>}
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
            <h3>{zh ? `${yinYang}${ELEMENT_NAME[dmEl].zh} · ${chart.strong ? t.strong : t.weak}` : `${yinYang} ${ELEMENT_NAME[dmEl].en} · ${chart.strong ? t.strong : t.weak}`}</h3>
            <p className="small">{zh ? DM_LINE[chart.dayMaster].zh : DM_LINE[chart.dayMaster].en}</p>
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
              <span className="bar-label"><span className="han" style={{ color: `var(--${e})` }}>{EL_HAN[e]}</span>{zh ? '' : ELEMENT_NAME[e].en}</span>
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

function Settings({ lang, setLang, ics, setIcs, onReset, chart, mail, mailAddr, mailUsage, onEnableMail, onCheckMail, onClearMail, account, providers }: { account: Account | null; providers: string[]; lang: Lang; setLang: (l: Lang) => void; ics: { url: string; events: CalEvent[]; at?: string } | null; setIcs: (v: { url: string; events: CalEvent[]; at?: string } | null) => void; onReset: () => void; chart: Chart; mail: MailItem[]; mailAddr: string | null; mailUsage: { used: number; limit: number } | null; onEnableMail: () => Promise<void>; onCheckMail: () => Promise<number>; onClearMail: () => void }) {
  const t = T[lang];
  const [url, setUrl] = useState(ics?.url ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  async function connect() {
    setState('busy');
    const res = await fetch('/api/ics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) }).catch(() => null);
    const j = res && res.ok ? await res.json() : null;
    if (j?.events) { setIcs({ url, events: j.events, at: new Date().toISOString() }); setState('idle'); } else setState('error');
  }
  return (
    <div className="stack">
      <h1>{t.settings}</h1>
      <AccountCard lang={lang} account={account} providers={providers} />
      <section className="card">
        <div className="label">{t.language}</div>
        <div className="seg">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button>
        </div>
      </section>
      <section className="card form">
        <div className="label">{t.calendar}</div>
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
      </section>
      <MailSection lang={lang} chart={chart} mail={mail} mailAddr={mailAddr} usage={mailUsage} onEnable={onEnableMail} onCheck={onCheckMail} onClear={onClearMail} />
      <p className="muted small">{t.privacy}</p>
      <button className="ghost danger danger-btn" onClick={onReset}>{t.reset}</button>
      <Footer lang={lang} />
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
        {!compact && <button className="ghost" onClick={() => { Object.values(K).forEach((k) => localStorage.removeItem(k)); signOut({ redirectTo: '/' }); }}>{t.signOut}</button>}
      </section>
    );
  }
  if (!providers.length) return null;
  return (
    <section className={compact ? 'stack' : 'card stack'}>
      {!compact && <div className="label">{t.account}</div>}
      {providers.map((p) => (
        <button key={p} className="social" onClick={() => signIn(p, { redirectTo: '/' })}>
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
                    {r && <div className="small">{cat !== 'general' ? `${activityName(cat, lang)}: ` : ''}{r.reasons.filter((x) => x.scope !== 'hour' || !ev?.allDay).slice(0, 1).map((x) => (lang === 'zh' ? x.zh : x.en))}</div>}
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
