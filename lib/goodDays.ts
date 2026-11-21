import { Solar } from 'lunar-javascript';
import { ALMANAC_EN } from './i18n';

// General (not personal) good days from the traditional almanac (黄历), for public SEO pages.
export type L = 'en' | 'zh' | 'es';
export const GD_ACTS: { key: string; yi: string[]; en: string; zh: string; es: string; emoji: string }[] = [
  { key: 'wedding', yi: ['嫁娶'], en: 'Weddings', zh: '结婚嫁娶', es: 'Bodas', emoji: '💍' },
  { key: 'moving', yi: ['移徙', '入宅'], en: 'Moving house', zh: '搬家入宅', es: 'Mudanzas', emoji: '🏠' },
  { key: 'opening', yi: ['开市'], en: 'Opening a business', zh: '开业开市', es: 'Abrir un negocio', emoji: '🚀' },
  { key: 'signing', yi: ['立券', '交易', '订盟'], en: 'Signing contracts', zh: '签约交易', es: 'Firmar contratos', emoji: '✍️' },
  { key: 'travel', yi: ['出行'], en: 'Travel', zh: '出行', es: 'Viajes', emoji: '✈️' },
  { key: 'renovation', yi: ['动土', '修造', '破土'], en: 'Renovation & groundbreaking', zh: '装修动土', es: 'Obras y reformas', emoji: '🔨' },
  { key: 'money', yi: ['纳财'], en: 'Receiving money', zh: '纳财求财', es: 'Recibir dinero', emoji: '💰' },
  { key: 'medical', yi: ['求医', '治病', '求医疗病'], en: 'Medical treatment', zh: '求医治病', es: 'Tratamientos médicos', emoji: '🩺' },
];
export const MONTH_NAMES: Record<L, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
};
const WD: Record<L, string[]> = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'], es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] };

export interface GDay { d: number; wd: number; ganzhi: string; lunar: string; yi: string[]; ji: string[]; officer: string; clash: string; good: string[] }
export function monthDays(y: number, m: number): GDay[] {
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => {
    const s = Solar.fromYmd(y, m, i + 1), l = s.getLunar();
    const yi: string[] = l.getDayYi(), ji: string[] = l.getDayJi();
    const good = GD_ACTS.filter((a) => a.yi.some((w) => yi.includes(w)) && !a.yi.some((w) => ji.includes(w))).map((a) => a.key);
    return { d: i + 1, wd: s.getWeek(), ganzhi: l.getDayInGanZhi(), lunar: `${l.getMonthInChinese()}月${l.getDayInChinese()}`, yi, ji, officer: l.getZhiXing(), clash: l.getDayChongDesc(), good };
  });
}
export const gloss = (w: string, lang: L) => (lang === 'zh' ? w : ALMANAC_EN[w] ?? w);
export const wdName = (wd: number, lang: L) => WD[lang][wd];
export const ymOk = (ym: string) => /^20(2[5-9]|30)-(0[1-9]|1[0-2])$/.test(ym);
export const shiftYm = (ym: string, k: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
// the months we pre-build and list in the sitemap: this month through the next 13
export function featuredMonths(now = new Date()) {
  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return Array.from({ length: 14 }, (_, i) => shiftYm(start, i));
}
export const langPrefix = (lang: L) => (lang === 'en' ? '' : `/${lang}`);
