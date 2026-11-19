'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BirthInput, CalEvent, Category, Chart, computeChart, readEvent, scoreDay, dayActivities, activityName, STEM, BRANCH, ELEMENT_NAME, Element, HIDDEN,
} from '@/lib/engine';
import { T, Lang, almanac } from '@/lib/i18n';
import { buildContext, fallbackAnswer, fmtDay, fmtHour } from '@/lib/bot';
import Footer from '@/components/Footer';
import { CONTACT_EMAIL } from '@/lib/site';
import type { MailItem } from '@/lib/mail';

interface Profile { name: string; birth: BirthInput; place: string }
type Tab = 'today' | 'ask' | 'chart' | 'settings';
interface Msg { role: 'user' | 'assistant'; text: string }

const K = { profile: 'fatecal.profile', events: 'fatecal.events', ics: 'fatecal.ics', lang: 'fatecal.lang', mailKey: 'fatecal.mailkey', mailAddr: 'fatecal.mailaddr', mail: 'fatecal.mail' };

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
  if (!m.start || m.kind === 'verify') return null;
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

  // Fetch forwarded mail: on start, then every minute while the app is open.
  async function checkMail(key = mailKey, peek = false) {
    if (!key) return 0;
    const j = await fetch('/api/inbox', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, peek }) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!j) return -1;
    if (j.address) { setMailAddr(j.address); save(K.mailAddr, j.address); }
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
  if (!ready) return <div className="preload"><Onboarding lang={lang} setLang={setLang} initial={null} onDone={() => {}} /></div>;
  if (!profile || !chart) {
    return <Onboarding lang={lang} setLang={setLang} initial={null} onDone={(p) => { setProfile(p); save(K.profile, p); }} />;
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">FateCal</div>
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} aria-label="Switch language">{lang === 'en' ? '中文' : 'EN'}</button>
      </header>
      <main className="main">
        {tab === 'today' && <Today lang={lang} chart={chart} events={events} manual={manual} setManual={setManual} />}
        {tab === 'ask' && <Ask lang={lang} chart={chart} events={events} />}
        {tab === 'chart' && <ChartView lang={lang} chart={chart} profile={profile} onEdit={(p) => { setProfile(p); save(K.profile, p); }} />}
        {tab === 'settings' && (
          <Settings lang={lang} setLang={setLang} ics={ics} setIcs={setIcs} chart={chart}
            mail={mail} mailAddr={mailAddr} onEnableMail={enableMail} onCheckMail={() => checkMail()} onClearMail={() => setMail([])}
            onReset={() => { if (confirm(t.resetConfirm)) { Object.values(K).forEach((k) => localStorage.removeItem(k)); location.reload(); } }} />
        )}
      </main>
      <nav className="tabs">
        {(['today', 'ask', 'chart', 'settings'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} aria-label={t[k]}>
            <Icon name={k} />
            <span>{t[k]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---------------- onboarding ----------------

function Onboarding({ lang, setLang, initial, onDone, onCancel }: { lang: Lang; setLang: (l: Lang) => void; initial: Profile | null; onDone: (p: Profile) => void; onCancel?: () => void }) {
  const t = T[lang];
  const b = initial?.birth;
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(b ? `${b.year}-${pad(b.month)}-${pad(b.day)}` : '');
  const [time, setTime] = useState(b && !b.hourUnknown ? `${pad(b.hour)}:${pad(b.minute)}` : '');
  const [unknown, setUnknown] = useState(!!b?.hourUnknown);
  const [place, setPlace] = useState(initial?.place ?? '');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && (unknown || /^\d{2}:\d{2}$/.test(time));

  return (
    <div className="shell onboard">
      <div className="hero">
        <div className="brand big">FateCal</div>
        <p className="lead">{t.tagline}</p>
        {!initial && (
          <>
            <div className="card sample" aria-label={t.sampleLabel}>
              <div className="tiny">{t.sampleLabel}</div>
              <div className="row gap top-align">
                <div className="time">2:00 PM</div>
                <div className="grow">
                  <div className="ev-title">{t.sampleTitle}</div>
                  <div className="muted small">{t.sampleWhy}</div>
                </div>
                <span className="tag bad">{t.bad}</span>
              </div>
              <div className="suggest small">{t.sampleSuggest}</div>
            </div>
            <ul className="points">{t.points.map((x) => <li key={x}>{x}</li>)}</ul>
            <details className="explain">
              <summary>{t.whatIsBazi}</summary>
              <p className="small">{t.baziExplain}</p>
            </details>
          </>
        )}
        <div className="seg">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>中文</button>
        </div>
      </div>
      <form className="card form" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const [y, m, d] = date.split('-').map(Number);
        const [hh, mm] = unknown ? [12, 0] : time.split(':').map(Number);
        onDone({ name: name.trim(), place: place.trim(), birth: { year: y, month: m, day: d, hour: hh, minute: mm, hourUnknown: unknown } });
      }}>
        <label>{t.name}<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        <label>{t.birthDate}<input type="date" required value={date} min="1900-01-01" max="2100-12-31" onChange={(e) => setDate(e.target.value)} /></label>
        <label>{t.birthTime}<input type="time" value={time} disabled={unknown} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />{t.timeUnknown}</label>
        <label>{t.birthPlace}<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Shanghai / Los Angeles" /></label>
        <p className="muted small">{t.birthPlaceHint} {t.privacyShort}</p>
        <button className="primary" disabled={!valid}>{initial ? t.save : t.continue}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>{t.cancel}</button>}
      </form>
      <p className="muted small pad">{t.simplified}</p>
      {!initial && <Footer lang={lang} />}
    </div>
  );
}

// ---------------- today ----------------

function VerdictTag({ v, lang }: { v: 'good' | 'neutral' | 'bad'; lang: Lang }) {
  return <span className={`tag ${v}`}>{T[lang][v]}</span>;
}

function Today({ lang, chart, events, manual, setManual }: { lang: Lang; chart: Chart; events: CalEvent[]; manual: CalEvent[]; setManual: (e: CalEvent[]) => void }) {
  const t = T[lang];
  const [day, setDay] = useState(() => new Date());
  const [adding, setAdding] = useState(false);
  const summary = useMemo(() => scoreDay(chart, day), [chart, day]);
  const acts = useMemo(() => dayActivities(chart, day), [chart, day]);
  const [trad, setTrad] = useState(false);
  const sep = lang === 'zh' ? '、' : ', ';
  const todays = events.filter((e) => sameDay(new Date(e.start), day));
  const shift = (n: number) => setDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + n));
  const isToday = sameDay(day, new Date());

  return (
    <div className="stack">
      <div className="daynav">
        <button className="icon" onClick={() => shift(-1)} aria-label={t.prevDay}>‹</button>
        <div className="center">
          <div className="muted small">{summary.ganZhi} · {STEM[summary.ganZhi[0]].pinyin}-{BRANCH[summary.ganZhi[1]].pinyin}</div>
          <h1>{isToday ? t.today : fmtDay(day, lang)}</h1>
        </div>
        <button className="icon" onClick={() => shift(1)} aria-label={t.nextDay}>›</button>
      </div>

      <section className="dark card">
        <div className="ring"><b>{summary.score}</b><span>{t.dayScore}</span></div>
        <div className="grow">
          <div className="row gap"><VerdictTag v={summary.verdict} lang={lang} /><span>{t.verdictLine[summary.verdict]}</span></div>
          <p className="small soft"><b>{t.goodFor}:</b> {acts.good.length ? acts.good.slice(0, 4).map((a) => activityName(a.cat, lang)).join(sep) : t.routineOnly}</p>
          <p className="small soft"><b>{t.avoid}:</b> {acts.avoid.length ? acts.avoid.slice(0, 4).map((a) => activityName(a.cat, lang)).join(sep) : t.nothingMajor}</p>
          <button className="link light" onClick={() => setTrad(!trad)} aria-expanded={trad}>{trad ? t.hideAlmanac : t.showAlmanac}</button>
          {trad && (
            <div className="small soft">
              <p><b>{lang === 'zh' ? '宜' : 'Almanac yi'}:</b> {summary.yi.map((w) => almanac(w, lang)).join(sep)}</p>
              <p><b>{lang === 'zh' ? '忌' : 'Almanac ji'}:</b> {summary.ji.map((w) => almanac(w, lang)).join(sep)}</p>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="label">{t.bestHours}</div>
        <div className="row gap wrap">
          {summary.bestHours.map((h) => (
            <span key={h.start} className="pill">{fmtHour(h.start, lang)}–{fmtHour(h.start + 2, lang)} · {h.score}</span>
          ))}
        </div>
        <ul className="reasons">{summary.reasons.map((r, i) => <li key={i}>{lang === 'zh' ? r.zh : r.en}</li>)}</ul>
      </section>

      <div className="row between">
        <div className="label">{t.schedule}</div>
        <button className="link" onClick={() => setAdding(!adding)}>+ {t.addEvent}</button>
      </div>
      {adding && <AddEvent lang={lang} day={day} onSave={(e) => { setManual([...manual, e]); setAdding(false); }} onCancel={() => setAdding(false)} />}
      {todays.length === 0 && !adding && <p className="muted">{t.noEvents}</p>}
      {todays.map((e) => (
        <EventCard key={e.id} lang={lang} chart={chart} ev={e} all={events}
          onMove={(s, en) => setManual(manual.map((m) => (m.id === e.id ? { ...m, start: s, end: en } : m)))}
          onDelete={() => setManual(manual.filter((m) => m.id !== e.id))} />
      ))}
    </div>
  );
}

function AddEvent({ lang, day, onSave, onCancel }: { lang: Lang; day: Date; onSave: (e: CalEvent) => void; onCancel: () => void }) {
  const t = T[lang];
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(isoLocalDate(day));
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('15:00');
  return (
    <form className="card form" onSubmit={(e) => {
      e.preventDefault();
      if (!title.trim()) return;
      const s = new Date(`${date}T${from}`), en = new Date(`${date}T${to}`);
      if (en <= s) en.setTime(s.getTime() + 3600e3);
      onSave({ id: `m${Date.now()}`, title: title.trim(), start: s.toISOString(), end: en.toISOString(), source: 'manual' });
    }}>
      <label>{t.title}<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === 'zh' ? '和张总谈合作' : 'Partnership talk with Mr. Zhang'} required /></label>
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
  );
}

function EventCard({ lang, chart, ev, all, onMove, onDelete }: { lang: Lang; chart: Chart; ev: CalEvent; all: CalEvent[]; onMove: (s: string, e: string) => void; onDelete: () => void }) {
  const t = T[lang];
  const r = useMemo(() => readEvent(chart, ev, all), [chart, ev, all]);
  const [why, setWhy] = useState(false);
  const [copied, setCopied] = useState(false);
  // lead with what is specific to this event: the almanac for its activity, then its hour, then the day
  const rank = (x: { scope: string }) => (x.scope.startsWith('almanac') ? 0 : x.scope === 'hour' ? 1 : 2);
  const tops = [...r.reasons].sort((a, b) => rank(a) - rank(b) || Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
  const actLabel = r.category === 'general' ? '' : (lang === 'zh' ? `${activityName(r.category, lang)}：` : `For ${activityName(r.category, lang)}: `);
  const alt = r.alternatives[0];
  const altLabel = alt ? `${sameDay(new Date(alt.start), new Date(ev.start)) ? '' : fmtDay(new Date(alt.start), lang) + ' '}${fmtTime(alt.start, lang)}` : '';
  const note = alt
    ? lang === 'zh'
      ? `您好，「${ev.title}」原定 ${fmtDay(new Date(ev.start), lang)} ${fmtTime(ev.start, lang)}，可否改到 ${fmtDay(new Date(alt.start), lang)} ${fmtTime(alt.start, lang)}？谢谢！`
      : `Hi! Could we move "${ev.title}" from ${fmtDay(new Date(ev.start), lang)} ${fmtTime(ev.start, lang)} to ${fmtDay(new Date(alt.start), lang)} ${fmtTime(alt.start, lang)}? Thanks!`
    : '';

  return (
    <article className={`card event ${r.verdict === 'bad' ? 'warn' : ''}`}>
      <div className="row gap top-align">
        <div className="time">{ev.allDay ? (lang === 'zh' ? '全天' : 'All day') : fmtTime(ev.start, lang)}</div>
        <div className="grow">
          <div className="ev-title">{ev.title}</div>
          {tops.length > 0 && <div className="muted small">{actLabel}{tops.map((x) => (lang === 'zh' ? x.zh : x.en)).join(' ')}</div>}
        </div>
        <VerdictTag v={r.verdict} lang={lang} />
      </div>
      {!ev.allDay && (alt || r.verdict === 'bad') && (
        <div className="suggest">
          {alt ? (
            <>
              <p>{r.verdict === 'good' ? t.evenBetter : t.suggest} <b>{altLabel}</b> ({T[lang][alt.verdict]}, {alt.score})</p>
              {ev.source === 'manual' ? (
                <button className="primary" onClick={() => onMove(alt.start, alt.end)}>{t.moveTo} {altLabel}</button>
              ) : (
                <>
                  <p className="muted small">{t.calendarNote}</p>
                  <button className="primary" onClick={() => { navigator.clipboard?.writeText(note); setCopied(true); }}>{copied ? t.copied : t.copyNote}</button>
                </>
              )}
            </>
          ) : r.verdict === 'bad' ? <p className="small">{t.noBetter}</p> : null}
        </div>
      )}
      <div className="row gap">
        <button className="link" onClick={() => setWhy(!why)}>{why ? t.hide : t.why}</button>
        {ev.source === 'manual' && <button className="link danger" onClick={onDelete}>{t.del}</button>}
      </div>
      {why && (
        <ul className="reasons">
          {r.reasons.map((x, i) => <li key={i}><span className={x.delta >= 0 ? 'plus' : 'minus'}>{x.delta >= 0 ? '+' : ''}{x.delta}</span> {lang === 'zh' ? x.zh : x.en}</li>)}
          <li className="muted">{lang === 'zh' ? `综合 ${r.score} 分 · 日 ${r.dayGanZhi} · 时 ${r.hourGanZhi}` : `Score ${r.score} · ${STEM[r.dayGanZhi[0]].pinyin}-${BRANCH[r.dayGanZhi[1]].pinyin} day · ${BRANCH[r.hourGanZhi[1]].animal} hour`}</li>
        </ul>
      )}
    </article>
  );
}

// ---------------- ask ----------------

function Ask({ lang, chart, events }: { lang: Lang; chart: Chart; events: CalEvent[] }) {
  const t = T[lang];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    const history = msgs;
    setMsgs([...history, { role: 'user', text: question }, { role: 'assistant', text: '' }]);
    setQ('');
    setBusy(true);
    const put = (text: string) => setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', text }]);
    const fallback = (lead: string) => put(`${lead}\n\n${fallbackAnswer(chart, question, lang)}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ question, lang, history, context: buildContext(chart, events, question, lang) }),
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
      {msgs.length === 0 && (
        <div className="stack">
          {t.examples.map((ex) => <button key={ex} className="example" onClick={() => send(ex)}>{ex}</button>)}
        </div>
      )}
      <div className="msgs">
        {msgs.map((m, i) => (m.text ? <div key={i} className={`bubble ${m.role}`}>{m.text}</div> : null))}
        {busy && !msgs.at(-1)?.text && <div className="bubble assistant muted" aria-live="polite"><span className="dots">{t.thinking}</span></div>}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <label className="sr" htmlFor="q">{t.askTitle}</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.askPlaceholder} maxLength={500} />
        <button className="primary" disabled={busy || !q.trim()}>{t.send}</button>
      </form>
    </div>
  );
}

// ---------------- chart ----------------

function ChartView({ lang, chart, profile, onEdit }: { lang: Lang; chart: Chart; profile: Profile; onEdit: (p: Profile) => void }) {
  const t = T[lang];
  const [editing, setEditing] = useState(false);
  if (editing) return <Onboarding lang={lang} setLang={() => {}} initial={profile} onDone={(p) => { onEdit(p); setEditing(false); }} onCancel={() => setEditing(false)} />;
  const max = Math.max(...Object.values(chart.counts), 1);
  const el = (e: Element) => (lang === 'zh' ? ELEMENT_NAME[e].zh : ELEMENT_NAME[e].en);
  return (
    <div className="stack">
      <div>
        <div className="muted small">{[profile.name, profile.place].filter(Boolean).join(' · ')}</div>
        <h1>{t.myChart}</h1>
        <p className="muted small">
          {`${profile.birth.year}-${pad(profile.birth.month)}-${pad(profile.birth.day)}`} {profile.birth.hourUnknown ? t.timeUnknownShort : `${pad(profile.birth.hour)}:${pad(profile.birth.minute)}`} · {t.clockTimeNote}
        </p>
      </div>
      <div className="pillars">
        {chart.pillars.map((p) => {
          const hidden = p.label === 'hour' && chart.hourUnknown;
          return (
            <div key={p.label} className={`pillar ${p.label === 'day' ? 'dm' : ''}`}>
              <div className="small">{t[p.label]}</div>
              <div className="gz">{hidden ? '?' : p.stem}<br />{hidden ? '?' : p.branch}</div>
              <div className="tiny">{hidden ? '' : `${STEM[p.stem].pinyin} ${BRANCH[p.branch].pinyin}`}</div>
              {!hidden && <div className="tiny" title={t.hiddenStems}>{t.hiddenShort} {HIDDEN[p.branch].join('')}</div>}
            </div>
          );
        })}
      </div>
      <section className="card">
        <p><b>{t.dayMaster}:</b> {chart.dayMaster} {STEM[chart.dayMaster].pinyin} {el(chart.dayMasterElement)} · {chart.strong ? t.strong : t.weak}</p>
        <p><b>{t.favorable}:</b> {chart.favorable.map(el).join(lang === 'zh' ? '、' : ', ')}</p>
        <p><b>{t.unfavorable}:</b> {chart.unfavorable.map(el).join(lang === 'zh' ? '、' : ', ')}</p>
        <p className="small muted">{chart.strong ? t.strongExplain : t.weakExplain}</p>
        <p><b>{t.zodiac}:</b> {lang === 'zh' ? BRANCH[chart.yearBranch].zh : BRANCH[chart.yearBranch].animal} · <b>{t.sun}:</b> {lang === 'zh' ? chart.sunSign.zh : chart.sunSign.en}</p>
      </section>
      <section className="card">
        <div className="label">{t.elementBalance}</div>
        <p className="small muted">{t.balanceExplain}</p>
        {(Object.keys(chart.counts) as Element[]).map((e) => (
          <div key={e} className="bar-row">
            <span className="bar-label">{el(e)}</span>
            <span className="bar"><span className={`fill ${e}`} style={{ width: `${(chart.counts[e] / max) * 100}%` }} /></span>
            <span className="small">{chart.counts[e]}</span>
          </div>
        ))}
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

function Settings({ lang, setLang, ics, setIcs, onReset, chart, mail, mailAddr, onEnableMail, onCheckMail, onClearMail }: { lang: Lang; setLang: (l: Lang) => void; ics: { url: string; events: CalEvent[]; at?: string } | null; setIcs: (v: { url: string; events: CalEvent[]; at?: string } | null) => void; onReset: () => void; chart: Chart; mail: MailItem[]; mailAddr: string | null; onEnableMail: () => Promise<void>; onCheckMail: () => Promise<number>; onClearMail: () => void }) {
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
      <MailSection lang={lang} chart={chart} mail={mail} mailAddr={mailAddr} onEnable={onEnableMail} onCheck={onCheckMail} onClear={onClearMail} />
      <p className="muted small">{t.privacy}</p>
      <button className="ghost danger" onClick={onReset}>{t.reset}</button>
      <Footer lang={lang} />
    </div>
  );
}

// ---------------- email forwarding ----------------

const KIND_CAT: Record<string, Category> = { meeting: 'meeting', order: 'money', travel: 'travel', bill: 'money', contract: 'signing', other: 'general' };

function MailSection({ lang, chart, mail, mailAddr, onEnable, onCheck, onClear }: { lang: Lang; chart: Chart; mail: MailItem[]; mailAddr: string | null; onEnable: () => Promise<void>; onCheck: () => Promise<number>; onClear: () => void }) {
  const t = T[lang];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const verify = [...mail].reverse().find((m) => m.kind === 'verify');
  const recent = mail.filter((m) => m.kind !== 'verify').slice(-8).reverse();
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
  if (name === 'chart') return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a4.25 4.25 0 0 1 0 8.5a4.25 4.25 0 0 0 0 8.5" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>;
}
