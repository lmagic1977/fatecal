import { Solar } from 'lunar-javascript';

// 梅花易数 time casting: a hexagram from the moment the question is asked (traditional method)
const TRI = ['', '乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const TRI_EN = ['', 'Heaven', 'Lake', 'Fire', 'Thunder', 'Wind', 'Water', 'Mountain', 'Earth'];
const LINES: Record<number, number[]> = { 1: [1, 1, 1], 2: [1, 1, 0], 3: [1, 0, 1], 4: [1, 0, 0], 5: [0, 1, 1], 6: [0, 1, 0], 7: [0, 0, 1], 8: [0, 0, 0] }; // bottom → top
const NAMES: Record<number, string[]> = {
  1: ['乾为天', '天泽履', '天火同人', '天雷无妄', '天风姤', '天水讼', '天山遁', '天地否'],
  2: ['泽天夬', '兑为泽', '泽火革', '泽雷随', '泽风大过', '泽水困', '泽山咸', '泽地萃'],
  3: ['火天大有', '火泽睽', '离为火', '火雷噬嗑', '火风鼎', '火水未济', '火山旅', '火地晋'],
  4: ['雷天大壮', '雷泽归妹', '雷火丰', '震为雷', '雷风恒', '雷水解', '雷山小过', '雷地豫'],
  5: ['风天小畜', '风泽中孚', '风火家人', '风雷益', '巽为风', '风水涣', '风山渐', '风地观'],
  6: ['水天需', '水泽节', '水火既济', '水雷屯', '水风井', '坎为水', '水山蹇', '水地比'],
  7: ['山天大畜', '山泽损', '山火贲', '山雷颐', '山风蛊', '山水蒙', '艮为山', '山地剥'],
  8: ['地天泰', '地泽临', '地火明夷', '地雷复', '地风升', '地水师', '地山谦', '坤为地'],
};
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const triOf = (l: number[]) => Number(Object.keys(LINES).find((k) => LINES[+k].join() === l.join()));
const name = (u: number, d: number) => NAMES[u][d - 1];

export function timeHexagram(tz: string, at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]));
  const lunar = Solar.fromYmdHms(+p.year, +p.month, +p.day, +p.hour, +p.minute, 0).getLunar();
  const y = ZHI.indexOf(lunar.getYearZhi()) + 1, m = Math.abs(lunar.getMonth()), d = lunar.getDay(), h = ZHI.indexOf(lunar.getTimeZhi()) + 1;
  const up = ((y + m + d) % 8) || 8, low = ((y + m + d + h) % 8) || 8, moving = ((y + m + d + h) % 6) || 6;
  const all = [...LINES[low], ...LINES[up]];
  all[moving - 1] = 1 - all[moving - 1];
  const cLow = triOf(all.slice(0, 3)), cUp = triOf(all.slice(3));
  // 互卦: lines 2-4 below, 3-5 above
  const orig = [...LINES[low], ...LINES[up]];
  const hLow = triOf(orig.slice(1, 4)), hUp = triOf(orig.slice(2, 5));
  return {
    method: '梅花易数 time casting (year branch + lunar month + lunar day, + hour branch)',
    asked: `${p.year}-${p.month}-${p.day} ${p.hour}:${String(p.minute).padStart(2, '0')} (${tz}), lunar ${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getTimeZhi()}时`,
    main: `${name(up, low)} (upper ${TRI[up]}/${TRI_EN[up]}, lower ${TRI[low]}/${TRI_EN[low]})`,
    movingLine: moving,
    nuclear: name(hUp, hLow),
    changed: `${name(cUp, cLow)} (upper ${TRI[cUp]}, lower ${TRI[cLow]})`,
    bodyUse: moving <= 3 ? `体卦 (self) = upper ${TRI[up]}, 用卦 (the matter) = lower ${TRI[low]}` : `体卦 (self) = lower ${TRI[low]}, 用卦 (the matter) = upper ${TRI[up]}`,
  };
}
