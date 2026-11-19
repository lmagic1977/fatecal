// FateCal BaZi engine.
// Deterministic rules only: the AI layer explains these results, it never invents them.
// The model is a simplified, commonly used reading (day-master strength by element count,
// branch clashes / harmonies / harms, almanac yi-ji). Have a BaZi consultant review before launch.

import { Solar } from 'lunar-javascript';
import { ALMANAC_EN } from './i18n';

const gl = (w: string) => ALMANAC_EN[w] ?? w;

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type Verdict = 'good' | 'neutral' | 'bad';
export type Category =
  | 'meeting' | 'signing' | 'travel' | 'moving' | 'money' | 'build' | 'wedding' | 'medical'
  | 'conception' | 'romance' | 'opening' | 'haircut' | 'study' | 'cleaning' | 'general';

export type Scope = 'day' | 'hour' | 'almanac-day' | 'almanac-hour';
export interface Reason { delta: number; en: string; zh: string; scope: Scope }

export interface BirthInput { year: number; month: number; day: number; hour: number; minute: number; hourUnknown?: boolean }

export interface Chart {
  pillars: { label: 'year' | 'month' | 'day' | 'hour'; stem: string; branch: string }[];
  dayMaster: string;
  dayMasterElement: Element;
  dayBranch: string;
  yearBranch: string;
  counts: Record<Element, number>;
  strong: boolean;
  favorable: Element[];
  unfavorable: Element[];
  sunSign: { en: string; zh: string };
  hourUnknown: boolean;
}

export interface MomentScore {
  score: number;
  verdict: Verdict;
  reasons: Reason[];
  dayGanZhi: string;
  hourGanZhi: string;
}

// ---------- reference tables ----------

export const STEM: Record<string, { el: Element; pinyin: string }> = {
  甲: { el: 'wood', pinyin: 'Jia' }, 乙: { el: 'wood', pinyin: 'Yi' },
  丙: { el: 'fire', pinyin: 'Bing' }, 丁: { el: 'fire', pinyin: 'Ding' },
  戊: { el: 'earth', pinyin: 'Wu' }, 己: { el: 'earth', pinyin: 'Ji' },
  庚: { el: 'metal', pinyin: 'Geng' }, 辛: { el: 'metal', pinyin: 'Xin' },
  壬: { el: 'water', pinyin: 'Ren' }, 癸: { el: 'water', pinyin: 'Gui' },
};

export const BRANCH: Record<string, { el: Element; pinyin: string; animal: string; zh: string }> = {
  子: { el: 'water', pinyin: 'Zi', animal: 'Rat', zh: '鼠' }, 丑: { el: 'earth', pinyin: 'Chou', animal: 'Ox', zh: '牛' },
  寅: { el: 'wood', pinyin: 'Yin', animal: 'Tiger', zh: '虎' }, 卯: { el: 'wood', pinyin: 'Mao', animal: 'Rabbit', zh: '兔' },
  辰: { el: 'earth', pinyin: 'Chen', animal: 'Dragon', zh: '龙' }, 巳: { el: 'fire', pinyin: 'Si', animal: 'Snake', zh: '蛇' },
  午: { el: 'fire', pinyin: 'Wu', animal: 'Horse', zh: '马' }, 未: { el: 'earth', pinyin: 'Wei', animal: 'Goat', zh: '羊' },
  申: { el: 'metal', pinyin: 'Shen', animal: 'Monkey', zh: '猴' }, 酉: { el: 'metal', pinyin: 'You', animal: 'Rooster', zh: '鸡' },
  戌: { el: 'earth', pinyin: 'Xu', animal: 'Dog', zh: '狗' }, 亥: { el: 'water', pinyin: 'Hai', animal: 'Pig', zh: '猪' },
};

// hidden stems (藏干) of each branch, main stem first
export const HIDDEN: Record<string, string[]> = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'],
  午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};

export const ELEMENT_NAME: Record<Element, { en: string; zh: string }> = {
  wood: { en: 'Wood', zh: '木' }, fire: { en: 'Fire', zh: '火' }, earth: { en: 'Earth', zh: '土' },
  metal: { en: 'Metal', zh: '金' }, water: { en: 'Water', zh: '水' },
};

const GENERATES: Record<Element, Element> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const CONTROLS: Record<Element, Element> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
const generatedBy = (e: Element) => (Object.keys(GENERATES) as Element[]).find((k) => GENERATES[k] === e)!;
const controlledBy = (e: Element) => (Object.keys(CONTROLS) as Element[]).find((k) => CONTROLS[k] === e)!;

const pairKey = (a: string, b: string) => [a, b].sort().join('');
const CLASH = new Set(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'].map((p) => pairKey(p[0], p[1])));
const HARMONY = new Set(['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'].map((p) => pairKey(p[0], p[1])));
const HARM = new Set(['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'].map((p) => pairKey(p[0], p[1])));
const TRINE = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];

type BranchRel = 'clash' | 'harmony' | 'harm' | 'trine' | 'same' | 'none';
export function branchRelation(a: string, b: string): BranchRel {
  if (a === b) return 'same';
  const k = pairKey(a, b);
  if (CLASH.has(k)) return 'clash';
  if (HARMONY.has(k)) return 'harmony';
  if (HARM.has(k)) return 'harm';
  if (TRINE.some((t) => t.includes(a) && t.includes(b))) return 'trine';
  return 'none';
}

const branchLabel = (b: string) => ({ en: `${BRANCH[b].animal} (${BRANCH[b].pinyin})`, zh: b });

// ---------- sun sign ----------

const SIGNS: [number, number, string, string][] = [
  [1, 20, 'Capricorn', '摩羯座'], [2, 19, 'Aquarius', '水瓶座'], [3, 21, 'Pisces', '双鱼座'],
  [4, 20, 'Aries', '白羊座'], [5, 21, 'Taurus', '金牛座'], [6, 21, 'Gemini', '双子座'],
  [7, 23, 'Cancer', '巨蟹座'], [8, 23, 'Leo', '狮子座'], [9, 23, 'Virgo', '处女座'],
  [10, 23, 'Libra', '天秤座'], [11, 22, 'Scorpio', '天蝎座'], [12, 22, 'Sagittarius', '射手座'],
];
export function sunSign(month: number, day: number) {
  // Each entry: the sign that ends on (month, day-1). Approximate cusp dates.
  for (const [m, d, en, zh] of SIGNS) {
    if (month === m && day < d) return { en, zh };
  }
  const next = SIGNS.find(([m]) => m === month)!;
  const idx = SIGNS.indexOf(next);
  const [, , en, zh] = SIGNS[(idx + 1) % 12];
  return { en, zh };
}

// ---------- chart ----------

export function computeChart(b: BirthInput): Chart {
  const hour = b.hourUnknown ? 12 : b.hour;
  const lunar = Solar.fromYmdHms(b.year, b.month, b.day, hour, b.hourUnknown ? 0 : b.minute, 0).getLunar();
  const ec = lunar.getEightChar();
  const pillars = [
    { label: 'year' as const, stem: ec.getYearGan(), branch: ec.getYearZhi() },
    { label: 'month' as const, stem: ec.getMonthGan(), branch: ec.getMonthZhi() },
    { label: 'day' as const, stem: ec.getDayGan(), branch: ec.getDayZhi() },
    { label: 'hour' as const, stem: ec.getTimeGan(), branch: ec.getTimeZhi() },
  ];
  const used = b.hourUnknown ? pillars.slice(0, 3) : pillars;
  const counts: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of used) {
    counts[STEM[p.stem].el] += 1;
    // a branch counts through its hidden stems (main / middle / residual), and the month branch (season) weighs double
    const hs = HIDDEN[p.branch];
    const w = hs.length === 1 ? [1] : hs.length === 2 ? [0.7, 0.3] : [0.6, 0.3, 0.1];
    hs.forEach((st, i) => { counts[STEM[st].el] += w[i] * (p.label === 'month' ? 2 : 1); });
  }
  const dm = pillars[2].stem;
  const dmEl = STEM[dm].el;
  const total = Object.values(counts).reduce((a, c) => a + c, 0);
  const support = counts[dmEl] + counts[generatedBy(dmEl)];
  const strong = support >= total / 2;
  const favorable: Element[] = strong
    ? [GENERATES[dmEl], CONTROLS[dmEl], controlledBy(dmEl)] // output, wealth, officer drain a strong day master
    : [generatedBy(dmEl), dmEl]; // resource and companion support a weak one
  const unfavorable = (Object.keys(counts) as Element[]).filter((e) => !favorable.includes(e));
  (Object.keys(counts) as Element[]).forEach((k) => { counts[k] = Math.round(counts[k] * 10) / 10; });
  return {
    pillars, dayMaster: dm, dayMasterElement: dmEl, dayBranch: pillars[2].branch, yearBranch: pillars[0].branch,
    counts, strong, favorable, unfavorable, sunSign: sunSign(b.month, b.day), hourUnknown: !!b.hourUnknown,
  };
}

// ---------- event categories ----------

const CATEGORY_WORDS: [Category, RegExp][] = [
  ['conception', /同房|备孕|求子|求嗣|怀孕|造人|受孕|conceive|conception|get pregnant|try(ing)? for a baby|ttc|intimacy|make love/i],
  ['romance', /约会|表白|求婚|相亲|date night|first date|\bdate\b|propose|proposal|romantic/i],
  ['opening', /开业|开张|开市|开店|上线|launch|grand opening|open(ing)? (a |the )?(store|shop|business)/i],
  ['haircut', /理发|剪发|剪头|haircut|hair cut|barber|salon/i],
  ['signing', /sign|contract|agreement|lease|closing|escrow|签约|签合同|合同|签署|过户/i],
  ['wedding', /wedding|marry|engagement|婚|订婚/i],
  ['moving', /move|moving|move-in|搬家|入住|乔迁/i],
  ['build', /renovat|construction|groundbreak|remodel|装修|动土|开工/i],
  ['travel', /flight|trip|travel|airport|drive to|出差|旅行|航班|出发/i],
  ['medical', /doctor|dentist|surgery|clinic|hospital|医生|手术|医院|看病/i],
  ['money', /invest|buy|purchase|bank|loan|pay|shopping|投资|买|购|贷款|理财/i],
  ['study', /考试|面试准备|学习|上课|入学|\bexams?\b|study|class|school/i],
  ['cleaning', /大扫除|扫除|打扫|清洁|cleaning|declutter/i],
  ['meeting', /meet|talk|partner|call|interview|pitch|negotiat|sync|1:1|lunch|dinner|会|谈|面试|约|拜访|客户/i],
];
export function categorize(title: string): Category {
  for (const [c, re] of CATEGORY_WORDS) if (re.test(title)) return c;
  return 'general';
}

// almanac (黄历) activity words that match each category
const ALMANAC: Record<Category, string[]> = {
  meeting: ['会亲友', '见贵', '求财'],
  signing: ['立券', '交易', '订盟'],
  travel: ['出行'],
  moving: ['移徙', '入宅'],
  money: ['纳财', '求财', '交易'],
  build: ['动土', '修造', '破土'],
  wedding: ['嫁娶', '纳采'],
  medical: ['求医', '疗病', '治病'],
  conception: ['求嗣', '嫁娶'],
  romance: ['嫁娶', '纳采', '会亲友'],
  opening: ['开市', '交易', '挂匾'],
  haircut: ['理发'],
  study: ['入学', '习艺'],
  cleaning: ['扫舍', '解除'],
  general: [],
};

// ---------- scoring ----------

function verdictOf(score: number): Verdict {
  return score >= 68 ? 'good' : score >= 52 ? 'neutral' : 'bad';
}

export function scoreMoment(chart: Chart, when: Date, category: Category = 'general'): MomentScore {
  const lunar = Solar.fromDate(when).getLunar();
  const dayStem: string = lunar.getDayGan();
  const dayBranch: string = lunar.getDayZhi();
  const hourStem: string = lunar.getTimeGan();
  const hourBranch: string = lunar.getTimeZhi();
  const reasons: Reason[] = [];
  let scope: Scope = 'day';
  const add = (delta: number, en: string, zh: string) => reasons.push({ delta, en, zh, scope });
  const dm = `${STEM[chart.dayMaster].pinyin} ${ELEMENT_NAME[chart.dayMasterElement].en}`;
  const dmZh = `${chart.dayMaster}${ELEMENT_NAME[chart.dayMasterElement].zh}`;

  // 1. day stem element vs favorable elements
  const dEl = STEM[dayStem].el;
  if (chart.favorable.includes(dEl))
    add(8, `It is a ${STEM[dayStem].pinyin} ${ELEMENT_NAME[dEl].en} day, an element that helps your ${dm} Day Master.`,
      `当日${dayStem}${ELEMENT_NAME[dEl].zh}，是你的喜用之气，扶助日主${dmZh}。`);
  else
    add(-6, `It is a ${STEM[dayStem].pinyin} ${ELEMENT_NAME[dEl].en} day, an element that works against your ${dm} Day Master.`,
      `当日${dayStem}${ELEMENT_NAME[dEl].zh}，非你喜用，对日主${dmZh}不利。`);

  // 2. day branch vs natal day branch and year branch
  const nb = branchLabel(chart.dayBranch), db = branchLabel(dayBranch);
  const dRel = branchRelation(dayBranch, chart.dayBranch);
  if (dRel === 'clash') add(-15, `The ${db.en} day clashes with your ${nb.en} day branch: friction and reversals.`, `当日${dayBranch}与你日支${chart.dayBranch}相冲，易生变数。`);
  if (dRel === 'harm') add(-7, `The ${db.en} day harms your ${nb.en} day branch: hidden obstacles.`, `当日${dayBranch}与你日支${chart.dayBranch}相害，暗中阻碍。`);
  if (dRel === 'harmony') add(9, `The ${db.en} day combines with your ${nb.en} day branch: things come together.`, `当日${dayBranch}与你日支${chart.dayBranch}六合，人和事顺。`);
  if (dRel === 'trine') add(5, `The ${db.en} day forms a trine with your ${nb.en} day branch.`, `当日${dayBranch}与你日支${chart.dayBranch}三合，有助力。`);
  if (branchRelation(dayBranch, chart.yearBranch) === 'clash')
    add(-6, `The day clashes with your zodiac sign (${BRANCH[chart.yearBranch].animal}).`, `当日冲你的生肖（属${BRANCH[chart.yearBranch].zh}）。`);

  // 3. hour branch vs natal day branch
  scope = 'hour';
  {
    const hb = branchLabel(hourBranch);
    const hRel = branchRelation(hourBranch, chart.dayBranch);
    if (hRel === 'clash') add(-12, `${hb.en} hour clashes with your ${nb.en} day branch.`, `${hourBranch}时与你日支${chart.dayBranch}相冲。`);
    if (hRel === 'harm') add(-9, `${hb.en} hour harms your ${nb.en} day branch, so talks tend to stall.`, `${hourBranch}时与你日支${chart.dayBranch}相害，谈事易生分歧。`);
    if (hRel === 'harmony') add(8, `${hb.en} hour combines with your ${nb.en} day branch.`, `${hourBranch}时与你日支${chart.dayBranch}六合，顺利。`);
    if (hRel === 'trine') add(5, `${hb.en} hour forms a trine with your ${nb.en} day branch.`, `${hourBranch}时与你日支${chart.dayBranch}三合，有助力。`);
    const hEl = STEM[hourStem].el;
    if (chart.favorable.includes(hEl)) add(3, `The hour stem (${ELEMENT_NAME[hEl].en}) is favorable for you.`, `时干${hourStem}${ELEMENT_NAME[hEl].zh}为喜用。`);
  }

  // 4. almanac yi / ji for the activity
  const words = ALMANAC[category];
  if (words.length) {
    const dayYi: string[] = lunar.getDayYi(), dayJi: string[] = lunar.getDayJi();
    const hourYi: string[] = lunar.getTimeYi(), hourJi: string[] = lunar.getTimeJi();
    const hit = (list: string[]) => words.find((w) => list.includes(w));
    let w: string | undefined;
    scope = 'almanac-day';
    if ((w = hit(dayYi))) add(7, `The almanac favors this that day (${gl(w)}).`, `黄历当日宜「${w}」。`);
    if ((w = hit(dayJi))) add(-10, `The almanac advises against this that day (${gl(w)}).`, `黄历当日忌「${w}」。`);
    scope = 'almanac-hour';
    if ((w = hit(hourYi))) add(3, `This hour suits it (${gl(w)}).`, `此时宜「${w}」。`);
    if ((w = hit(hourJi))) add(-5, `This hour is unsuited to it (${gl(w)}).`, `此时忌「${w}」。`);
  }

  // 5. day officer (建除十二值星)
  scope = 'day';
  const officer: string = lunar.getZhiXing();
  if (officer === '破') add(-6, 'A "Break" day in the almanac: avoid starting important things.', '当日值「破」，不宜开始大事。');
  if (officer === '成' || officer === '开') add(4, `An "${officer === '成' ? 'Success' : 'Open'}" day in the almanac.`, `当日值「${officer}」，利于成事。`);

  const score = Math.max(5, Math.min(98, 60 + reasons.reduce((a, r) => a + r.delta, 0)));
  return { score, verdict: verdictOf(score), reasons, dayGanZhi: `${dayStem}${dayBranch}`, hourGanZhi: `${hourStem}${hourBranch}` };
}

export interface DaySummary {
  score: number; verdict: Verdict; ganZhi: string; yi: string[]; ji: string[]; reasons: Reason[]; bestHours: { start: number; score: number }[];
}

// A day's overall reading (scored at noon, general activity) plus its best two-hour blocks.
export function scoreDay(chart: Chart, date: Date): DaySummary {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const base = scoreMoment(chart, noon, 'general');
  const dayOnly = base.reasons.filter((r) => r.scope === 'day');
  const lunar = Solar.fromDate(noon).getLunar();
  const hours = [7, 9, 11, 13, 15, 17, 19].map((h) => ({
    start: h, score: scoreMoment(chart, new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 30), 'general').score,
  })).sort((a, b) => b.score - a.score);
  const score = Math.max(5, Math.min(98, 60 + dayOnly.reduce((a, r) => a + r.delta, 0)));
  return { score, verdict: verdictOf(score), ganZhi: base.dayGanZhi, yi: lunar.getDayYi(), ji: lunar.getDayJi(), reasons: dayOnly, bestHours: hours.slice(0, 2).sort((a, b) => a.start - b.start) };
}

// Modern activities shown as "good for / avoid" in place of the raw almanac list.
export const ACTIVITIES: { cat: Category; en: string; zh: string }[] = [
  { cat: 'meeting', en: 'meetings & negotiations', zh: '会面谈判' },
  { cat: 'signing', en: 'signing contracts', zh: '签约' },
  { cat: 'travel', en: 'travel', zh: '出行' },
  { cat: 'opening', en: 'launches & openings', zh: '发布开业' },
  { cat: 'money', en: 'big purchases', zh: '大额消费' },
  { cat: 'moving', en: 'moving house', zh: '搬家' },
  { cat: 'romance', en: 'dates & proposals', zh: '约会求婚' },
  { cat: 'medical', en: 'medical visits', zh: '就医' },
  { cat: 'haircut', en: 'haircuts', zh: '理发' },
];
export const activityName = (c: Category, lang: 'en' | 'zh') => {
  const a = ACTIVITIES.find((x) => x.cat === c);
  if (a) return lang === 'zh' ? a.zh : a.en;
  return ({ build: ['renovation', '装修动土'], wedding: ['weddings', '婚嫁'], conception: ['trying for a baby', '求子'], study: ['study & exams', '学习考试'], cleaning: ['cleaning', '打扫'], general: ['this', '此事'] } as Record<string, string[]>)[c]?.[lang === 'zh' ? 1 : 0] ?? c;
};

export function dayActivities(chart: Chart, date: Date) {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0);
  const good: { cat: Category; score: number }[] = [], avoid: { cat: Category; score: number }[] = [];
  for (const a of ACTIVITIES) {
    const m = scoreMoment(chart, noon, a.cat);
    const rs = m.reasons.filter((r) => r.scope === 'day' || r.scope === 'almanac-day');
    const score = Math.max(5, Math.min(98, 60 + rs.reduce((x, r) => x + r.delta, 0)));
    const yi = rs.some((r) => r.scope === 'almanac-day' && r.delta > 0);
    const ji = rs.some((r) => r.scope === 'almanac-day' && r.delta < 0);
    if (ji || score < 52) avoid.push({ cat: a.cat, score });
    else if (yi && score >= 60 || score >= 72) good.push({ cat: a.cat, score });
  }
  good.sort((a, b) => b.score - a.score);
  avoid.sort((a, b) => a.score - b.score);
  return { good, avoid };
}

export interface CalEvent { id: string; title: string; start: string; end: string; allDay?: boolean; source: 'manual' | 'calendar' }

export interface EventReading extends MomentScore { category: Category; alternatives: { start: string; end: string; score: number; verdict: Verdict }[] }

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

// Score an event and, if it is not good, suggest better slots the same day or the next two days
// that do not overlap any other event. Slots start on the traditional two-hour boundaries.
export function readEvent(chart: Chart, ev: CalEvent, all: CalEvent[]): EventReading {
  const start = new Date(ev.start), end = new Date(ev.end);
  const category = categorize(ev.title);
  const base = scoreMoment(chart, start, category);
  const alternatives: EventReading['alternatives'] = [];
  if (!ev.allDay) {
    const dur = Math.max(30 * 60e3, end.getTime() - start.getTime());
    const busy = all.filter((o) => o.id !== ev.id && !o.allDay).map((o) => [new Date(o.start).getTime(), new Date(o.end).getTime()]);
    const cands: EventReading['alternatives'] = [];
    for (let d = 0; d < 3; d++) {
      for (const h of [9, 11, 13, 15, 17]) {
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d, h, 0);
        if (s.getTime() < Date.now()) continue;
        const e = new Date(s.getTime() + dur);
        if (busy.some(([b0, b1]) => overlaps(s.getTime(), e.getTime(), b0, b1))) continue;
        const sc = scoreMoment(chart, new Date(s.getTime() + 30 * 60e3), category);
        if (base.verdict === 'good' && d > 0) continue;
        if (sc.score >= base.score + 8 && sc.verdict !== 'bad') cands.push({ start: s.toISOString(), end: e.toISOString(), score: sc.score, verdict: sc.verdict });
      }
    }
    // prefer same day, then higher score
    const sameDay = (iso: string) => (new Date(iso).toDateString() === start.toDateString() ? 1 : 0);
    cands.sort((a, b) => sameDay(b.start) - sameDay(a.start) || b.score - a.score);
    alternatives.push(...cands.slice(0, 2));
  }
  return { ...base, category, alternatives };
}
