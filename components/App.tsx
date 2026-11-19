'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BirthInput, CalEvent, Chart, computeChart, readEvent, scoreDay, STEM, BRANCH, ELEMENT_NAME, Element,
} from '@/lib/engine';
import { T, Lang, almanac } from '@/lib/i18n';
import { buildContext, fallbackAnswer, fmtDay, fmtHour } from '@/lib/bot';

interface Profile { name: string; birth: BirthInput; place: string }
type Tab = 'today' | 'ask' | 'chart' | 'settings';
interface Msg { role: 'user' | 'assistant'; text: string }

const K = { profile: 'fatecal.profile', events: 'fatecal.events', ics: 'fatecal.ics', lang: 'fatecal.lang' };

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const tLocale = (lang: Lang) => (lang === 'zh' ? 'zh-CN' : 'en-US');
const fmtTime = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(tLocale(lang), { hour: 'numeric', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');
const isoLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function App() {
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [manual, setManual] = useState<CalEvent[]>([]);
  const [ics, setIcs] = useState<{ url: string; events: CalEvent[]; at?: string } | null>(null);
  const [tab, setTab] = useState<Tab>('today');

  useEffect(() => {
    const stored = load<Lang | null>(K.lang, null);
    setLang(stored ?? (navigator.language?.startsWith('zh') ? 'zh' : 'en'));
    setProfile(load<Profile | null>(K.profile, null));
    setManual(load<CalEvent[]>(K.events, []));
    setIcs(load(K.ics, null));
    setReady(true);
  }, []);
  useEffect(() => { if (ready) save(K.lang, lang); }, [lang, ready]);
  useEffect(() => { if (ready) save(K.events, manual); }, [manual, ready]);
  useEffect(() => { if (ready) save(K.ics, ics); }, [ics, ready]);

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
  const events = useMemo(() => [...manual, ...(ics?.events ?? [])].sort((a, b) => a.start.localeCompare(b.start)), [manual, ics]);
  const t = T[lang];

  if (!ready) return <div className="shell" />;
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
          <Settings lang={lang} setLang={setLang} ics={ics} setIcs={setIcs}
            onReset={() => { if (confirm(t.resetConfirm)) { Object.values(K).forEach((k) => localStorage.removeItem(k)); location.reload(); } }} />
        )}
      </main>
      <nav className="tabs">
        {(['today', 'ask', 'chart', 'settings'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}>
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
        <p className="muted small">{t.birthPlaceHint}</p>
        <button className="primary" disabled={!valid}>{initial ? t.save : t.continue}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>{t.cancel}</button>}
      </form>
      <p className="muted small pad">{t.simplified}</p>
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
          <p className="small soft"><b>{t.goodFor}:</b> {summary.yi.slice(0, 5).map((w) => almanac(w, lang)).join(lang === 'zh' ? '、' : ', ')}</p>
          <p className="small soft"><b>{t.avoid}:</b> {summary.ji.slice(0, 5).map((w) => almanac(w, lang)).join(lang === 'zh' ? '、' : ', ')}</p>
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
  const top = [...r.reasons].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
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
          {top && <div className="muted small">{lang === 'zh' ? top.zh : top.en}</div>}
        </div>
        <VerdictTag v={r.verdict} lang={lang} />
      </div>
      {r.verdict !== 'good' && !ev.allDay && (
        <div className="suggest">
          {alt ? (
            <>
              <p>{t.suggest} <b>{altLabel}</b> ({T[lang][alt.verdict]}, {alt.score})</p>
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
          <li className="muted">{lang === 'zh' ? `综合 ${r.score} 分 · 日 ${r.dayGanZhi} · 时 ${r.hourGanZhi}` : `Score ${r.score} · day ${r.dayGanZhi} · hour ${r.hourGanZhi}`}</li>
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
    setMsgs([...history, { role: 'user', text: question }]);
    setQ('');
    setBusy(true);
    let answer = '';
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, lang, history, context: buildContext(chart, events, question, lang) }),
      });
      const j = await res.json().catch(() => ({}));
      answer = j.answer || `${t.offline}\n\n${fallbackAnswer(chart, question, lang)}`;
    } catch {
      answer = `${t.offline}\n\n${fallbackAnswer(chart, question, lang)}`;
    }
    setMsgs((m) => [...m, { role: 'assistant', text: answer }]);
    setBusy(false);
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
        {msgs.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}
        {busy && <div className="bubble assistant muted">{t.thinking}</div>}
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
        <div className="muted small">{profile.name || ''} {profile.place ? `· ${profile.place}` : ''}</div>
        <h1>{t.myChart}</h1>
      </div>
      <div className="pillars">
        {chart.pillars.map((p) => {
          const hidden = p.label === 'hour' && chart.hourUnknown;
          return (
            <div key={p.label} className={`pillar ${p.label === 'day' ? 'dm' : ''}`}>
              <div className="small">{t[p.label]}</div>
              <div className="gz">{hidden ? '?' : p.stem}<br />{hidden ? '?' : p.branch}</div>
              <div className="tiny">{hidden ? '' : `${STEM[p.stem].pinyin} ${BRANCH[p.branch].pinyin}`}</div>
            </div>
          );
        })}
      </div>
      <section className="card">
        <p><b>{t.dayMaster}:</b> {chart.dayMaster} {STEM[chart.dayMaster].pinyin} {el(chart.dayMasterElement)} · {chart.strong ? t.strong : t.weak}</p>
        <p><b>{t.favorable}:</b> {chart.favorable.map(el).join(lang === 'zh' ? '、' : ', ')}</p>
        <p><b>{t.unfavorable}:</b> {chart.unfavorable.map(el).join(lang === 'zh' ? '、' : ', ')}</p>
        <p><b>{t.zodiac}:</b> {lang === 'zh' ? BRANCH[chart.yearBranch].zh : BRANCH[chart.yearBranch].animal} · <b>{t.sun}:</b> {lang === 'zh' ? chart.sunSign.zh : chart.sunSign.en}</p>
      </section>
      <section className="card">
        <div className="label">{t.elementBalance}</div>
        {(Object.keys(chart.counts) as Element[]).map((e) => (
          <div key={e} className="bar-row">
            <span className="bar-label">{el(e)}</span>
            <span className="bar"><span className={`fill ${e}`} style={{ width: `${(chart.counts[e] / max) * 100}%` }} /></span>
            <span className="small">{chart.counts[e]}</span>
          </div>
        ))}
      </section>
      <p className="muted small">{t.simplified}</p>
      <button className="ghost" onClick={() => setEditing(true)}>{t.editBirth}</button>
    </div>
  );
}

// ---------------- settings ----------------

function Settings({ lang, setLang, ics, setIcs, onReset }: { lang: Lang; setLang: (l: Lang) => void; ics: { url: string; events: CalEvent[]; at?: string } | null; setIcs: (v: { url: string; events: CalEvent[]; at?: string } | null) => void; onReset: () => void }) {
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
      <section className="card">
        <div className="label">{t.forwarding}</div>
        <p className="muted small">{t.forwardingSoon}</p>
      </section>
      <p className="muted small">{t.privacy}</p>
      <button className="ghost danger" onClick={onReset}>{t.reset}</button>
    </div>
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
