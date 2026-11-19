import { Chart, CalEvent, scoreDay, scoreMoment, readEvent, categorize, Category, STEM, BRANCH, ELEMENT_NAME } from './engine';
import { Lang, T, almanac } from './i18n';
import { fengshuiContext, Sex } from './fengshui';

const dayKey = (d: Date) => d.toDateString();
const fmtDay = (d: Date, lang: Lang) => d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtHour = (h: number, lang: Lang) => new Date(2000, 0, 1, h).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: 'numeric', minute: '2-digit' });

const pad2 = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Days the question points at, as offsets from today: today/tomorrow, weekdays (with "next week"),
// explicit dates like 11月25日 / 25号 / Nov 25 / 11/25.
export function targetOffsets(question: string, now = new Date()): number[] {
  const q = question.toLowerCase();
  const out = new Set<number>();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offsetOf = (d: Date) => Math.round((d.getTime() - today.getTime()) / 864e5);
  if (/today|tonight|今天|今晚|今日/.test(q)) out.add(0);
  if (/tomorrow|明天|明晚|明日/.test(q)) out.add(1);
  if (/day after tomorrow|后天/.test(q)) out.add(2);
  const nextWeek = /next week|next (sun|mon|tue|wed|thu|fri|sat)|下周|下星期|下礼拜/.test(q);
  const en = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const zh = ['[周星期礼拜]日|[周星期礼拜]天', '[周星期礼拜]一', '[周星期礼拜]二', '[周星期礼拜]三', '[周星期礼拜]四', '[周星期礼拜]五', '[周星期礼拜]六'];
  const dow = now.getDay();
  const nextMon = ((1 - dow + 7) % 7) || 7; // offset of next week's Monday
  en.forEach((w, i) => {
    if (!(q.includes(w) || q.includes(w.slice(0, 3) + ' ') || new RegExp(zh[i]).test(question))) return;
    out.add(nextWeek ? nextMon + ((i + 6) % 7) : (i - dow + 7) % 7);
  });
  if (nextWeek && out.size === 0) for (let k = 0; k < 7; k++) out.add(nextMon + k);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const pick = (m: number, d: number) => {
    let dt = new Date(now.getFullYear(), m - 1, d);
    if (dt < today) dt = new Date(now.getFullYear() + 1, m - 1, d);
    out.add(offsetOf(dt));
  };
  for (const m of question.matchAll(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/g)) pick(Number(m[1]), Number(m[2]));
  for (const m of q.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/g)) pick(months.indexOf(m[1]) + 1, Number(m[2]));
  for (const m of q.matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)) pick(Number(m[1]), Number(m[2]));
  if (!/月/.test(question)) for (const m of question.matchAll(/(\d{1,2})\s*号/g)) {
    const d = Number(m[1]);
    const dt = new Date(now.getFullYear(), now.getMonth() + (d < now.getDate() ? 1 : 0), d);
    out.add(offsetOf(dt));
  }
  return [...out].filter((o) => o >= 0 && o <= 400).sort((a, b) => a - b);
}

// Everything the AI may use: the chart; a detailed hour-by-hour reading for the next three days and
// any day the question names; a compact 60-day calendar (each day's verdict and its best slot for the
// activity in question, extended to cover any named date); and the person's events with their readings.
export function buildContext(chart: Chart, events: CalEvent[], question: string, lang: Lang, fs?: { birthYear: number; sex?: Sex }) {
  const category: Category = categorize(question);
  const now = new Date();
  const tr = (r: { en: string; zh: string }) => (lang === 'zh' ? r.zh : r.en);
  const vw = (v: 'good' | 'neutral' | 'bad') => T[lang][v];
  const at = (o: number, h = 0, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + o, h, m);
  const targets = targetOffsets(question, now);
  const detailed = [...new Set([0, 1, 2, ...targets])].sort((a, b) => a - b).slice(0, 10);

  const days = detailed.map((o) => {
    const d = at(o);
    const s = scoreDay(chart, d);
    const slots = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23].map((h) => {
      const m = scoreMoment(chart, at(o, h, 30), category);
      return { from: fmtHour(h, lang), to: fmtHour((h + 2) % 24, lang), ganZhi: m.hourGanZhi, verdict: vw(m.verdict), score: m.score, reasons: m.reasons.map(tr) };
    });
    return {
      date: fmtDay(d, lang), iso: localIso(d), ganZhi: s.ganZhi, verdict: vw(s.verdict), score: s.score,
      goodFor: s.yi.map((w) => almanac(w, lang)), avoid: s.ji.map((w) => almanac(w, lang)), almanacYiZh: s.yi, almanacJiZh: s.ji,
      reasons: s.reasons.map(tr), slots,
    };
  });

  const horizon = Math.max(60, (targets.at(-1) ?? 0) + 7);
  const calendar = [];
  for (let o = 0; o <= horizon; o++) {
    const d = at(o);
    const s = scoreDay(chart, d);
    const best = [7, 9, 11, 13, 15, 17, 19, 21]
      .map((h) => ({ h, m: scoreMoment(chart, at(o, h, 30), category) }))
      .sort((a, b) => b.m.score - a.m.score)[0];
    calendar.push({
      date: fmtDay(d, lang), iso: localIso(d), ganZhi: s.ganZhi, day: vw(s.verdict), dayScore: s.score,
      bestSlot: `${fmtHour(best.h, lang)}-${fmtHour(best.h + 2, lang)} ${vw(best.m.verdict)} ${best.m.score}`,
      bestSlotWhy: best.m.reasons.filter((r) => r.delta > 0).map(tr).slice(0, 2),
      yiZh: s.yi.slice(0, 10), jiZh: s.ji.slice(0, 10),
    });
  }
  const upcoming = events
    .filter((e) => new Date(e.end) >= now && new Date(e.start) < new Date(now.getTime() + 30 * 864e5))
    .slice(0, 40)
    .map((e) => {
      const r = readEvent(chart, e, events);
      return { title: e.title, start: new Date(e.start).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US'), verdict: vw(r.verdict), score: r.score, reasons: r.reasons.map((x) => (lang === 'zh' ? x.zh : x.en)), betterTimes: r.alternatives.map((a) => new Date(a.start).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')) };
    });
  return {
    now: now.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US'),
    activityScored: category, // 'general' means no specific activity was recognized; slots still carry the full day/hour reading
    chart: {
      pillars: chart.pillars.map((p) => `${p.label}: ${p.stem}${p.branch} (${STEM[p.stem].pinyin} ${BRANCH[p.branch].pinyin})`),
      dayMaster: `${chart.dayMaster} ${STEM[chart.dayMaster].pinyin} ${ELEMENT_NAME[chart.dayMasterElement].en}`,
      strength: chart.strong ? 'strong' : 'weak',
      favorable: chart.favorable.map((e) => ELEMENT_NAME[e].en),
      zodiac: BRANCH[chart.yearBranch].animal, sunSign: chart.sunSign.en, birthHourKnown: !chart.hourUnknown,
    },
    days, calendar, upcoming,
    fengShui: fs ? fengshuiContext(fs.birthYear, fs.sex, chart.favorable, now) : undefined,
  };
}

// Used when no AI key is configured: a plain rule-based answer from the same engine.
export function fallbackAnswer(chart: Chart, question: string, lang: Lang): string {
  const q = question.toLowerCase();
  const now = new Date();
  let offset = 0;
  if (/tomorrow|明天/.test(q)) offset = 1;
  else if (/day after|后天/.test(q)) offset = 2;
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const wdz = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  wd.forEach((w, i) => { if (q.includes(w) || question.includes(wdz[i])) offset = (i - now.getDay() + 7) % 7 || 7; });
  const category = categorize(question);
  const t = T[lang];

  if (/week|这周|本周|哪天|which day/.test(q)) {
    const list = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const best = [9, 11, 13, 15, 17].map((h) => ({ h, m: scoreMoment(chart, new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 30), category) })).sort((a, b) => b.m.score - a.m.score)[0];
      return { d, best };
    }).sort((a, b) => b.best.m.score - a.best.m.score).slice(0, 3);
    return list.map(({ d, best }) => `• ${fmtDay(d, lang)} ${fmtHour(best.h, lang)}: ${t[best.m.verdict]} (${best.m.score})`).join('\n');
  }

  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const day = scoreDay(chart, d);
  const hm = q.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/) || question.match(/(\d{1,2})\s*点/);
  const lines: string[] = [];
  lines.push(`${fmtDay(d, lang)} (${day.ganZhi}): ${t[day.verdict]}, ${day.score}/100.`);
  if (hm) {
    let h = Number(hm[1]);
    if (/pm|下午|晚上/.test(q) && h < 12) h += 12;
    const m = scoreMoment(chart, new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0), category);
    lines.push(`${fmtHour(h, lang)} → ${t[m.verdict]} (${m.score}). ${m.reasons.slice(0, 2).map((r) => (lang === 'zh' ? r.zh : r.en)).join(' ')}`);
  }
  const best = [7, 9, 11, 13, 15, 17, 19]
    .map((h) => ({ h, m: scoreMoment(chart, new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 30), category) }))
    .sort((a, b) => b.m.score - a.m.score).slice(0, 2);
  lines.push(`${lang === 'zh' ? '最佳时段' : 'Best times'}: ${best.map((b) => `${fmtHour(b.h, lang)}–${fmtHour(b.h + 2, lang)} (${t[b.m.verdict]})`).join(lang === 'zh' ? '，' : ', ')}`);
  if (day.reasons[0]) lines.push(lang === 'zh' ? day.reasons[0].zh : day.reasons[0].en);
  if (day.verdict === 'bad') {
    for (let i = 1; i <= 7; i++) {
      const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      const best2 = [9, 11, 13, 15, 17].map((h) => ({ h, m: scoreMoment(chart, new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, 30), category) })).sort((a, b) => b.m.score - a.m.score)[0];
      if (best2.m.verdict === 'good') {
        lines.push(lang === 'zh' ? `更好的选择：${fmtDay(n, lang)} ${fmtHour(best2.h, lang)}（${t.good}，${best2.m.score}）。` : `A better option: ${fmtDay(n, lang)} at ${fmtHour(best2.h, lang)} (${t.good}, ${best2.m.score}).`);
        break;
      }
    }
  }
  return lines.join('\n');
}

export { dayKey, fmtDay, fmtHour };
