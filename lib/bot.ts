import { Chart, CalEvent, scoreDay, scoreMoment, readEvent, categorize, Category, STEM, BRANCH, ELEMENT_NAME } from './engine';
import { Lang, T, almanac } from './i18n';

const dayKey = (d: Date) => d.toDateString();
const fmtDay = (d: Date, lang: Lang) => d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtHour = (h: number, lang: Lang) => new Date(2000, 0, 1, h).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: 'numeric', minute: '2-digit' });

// Everything the AI may use: the chart, 7 days of day readings, scored two-hour slots for the
// activity the question is about, and the person's events with their readings.
export function buildContext(chart: Chart, events: CalEvent[], question: string, lang: Lang) {
  const category: Category = categorize(question);
  const now = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const s = scoreDay(chart, d);
    const slots = [7, 9, 11, 13, 15, 17, 19, 21, 23].map((h) => {
      const m = scoreMoment(chart, new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 30), category);
      return { from: fmtHour(h, lang), to: fmtHour(h + 2, lang), ganZhi: m.hourGanZhi, verdict: m.verdict, score: m.score, reasons: m.reasons.map((r) => (lang === 'zh' ? r.zh : r.en)) };
    });
    days.push({
      date: fmtDay(d, lang), iso: d.toISOString().slice(0, 10), ganZhi: s.ganZhi, verdict: s.verdict, score: s.score,
      goodFor: s.yi.map((w) => almanac(w, lang)), avoid: s.ji.map((w) => almanac(w, lang)), almanacYiZh: s.yi, almanacJiZh: s.ji,
      reasons: s.reasons.map((r) => (lang === 'zh' ? r.zh : r.en)), slots,
    });
  }
  const upcoming = events
    .filter((e) => new Date(e.end) >= now && new Date(e.start) < new Date(now.getTime() + 7 * 864e5))
    .slice(0, 30)
    .map((e) => {
      const r = readEvent(chart, e, events);
      return { title: e.title, start: new Date(e.start).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US'), verdict: r.verdict, score: r.score, reasons: r.reasons.map((x) => (lang === 'zh' ? x.zh : x.en)), betterTimes: r.alternatives.map((a) => new Date(a.start).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')) };
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
    days, upcoming,
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
