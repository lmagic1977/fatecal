// FateCal feng shui: Eight Mansions (八宅) personal directions, annual Flying Stars (年飞星),
// and a home-facing check. Deterministic rules only, like the BaZi engine; the AI explains them.
// Simplified, commonly used methods. Have a feng shui consultant review before launch.

import { Solar } from 'lunar-javascript';
import { Element, ELEMENT_NAME } from './engine';

export type Sex = 'm' | 'f';
export type Dir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export const DIRS: Dir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const DIR_NAME: Record<Dir, { en: string; zh: string; es: string }> = {
  N: { en: 'North', zh: '北', es: 'Norte' }, NE: { en: 'Northeast', zh: '东北', es: 'Noreste' }, E: { en: 'East', zh: '东', es: 'Este' }, SE: { en: 'Southeast', zh: '东南', es: 'Sureste' },
  S: { en: 'South', zh: '南', es: 'Sur' }, SW: { en: 'Southwest', zh: '西南', es: 'Suroeste' }, W: { en: 'West', zh: '西', es: 'Oeste' }, NW: { en: 'Northwest', zh: '西北', es: 'Noroeste' },
};
export const OPPOSITE: Record<Dir, Dir> = { N: 'S', NE: 'SW', E: 'W', SE: 'NW', S: 'N', SW: 'NE', W: 'E', NW: 'SE' };
export const DIR_ELEMENT: Record<Dir, Element> = { N: 'water', S: 'fire', E: 'wood', SE: 'wood', W: 'metal', NW: 'metal', NE: 'earth', SW: 'earth' };

export function dirFromDegrees(deg: number): Dir {
  const d = ((deg % 360) + 360) % 360;
  return DIRS[Math.round(d / 45) % 8];
}

// ---------- year by Li Chun (立春), the start of the feng shui year ----------

const GZ60 = (y: number) => {
  const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
  const i = (((y - 4) % 60) + 60) % 60;
  return stems[i % 10] + branches[i % 12];
};
export function liChunYear(d: Date): number {
  const gz = Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0).getLunar().getYearInGanZhiByLiChun();
  return GZ60(d.getFullYear()) === gz ? d.getFullYear() : d.getFullYear() - 1;
}
export const yearGanZhi = GZ60;

const mod9 = (n: number) => { const r = ((n % 9) + 9) % 9; return r === 0 ? 9 : r; };

// ---------- Eight Mansions (八宅) ----------

export type Star8 = 'shengqi' | 'tianyi' | 'yannian' | 'fuwei' | 'huohai' | 'liusha' | 'wugui' | 'jueming';
export const STAR8: Record<Star8, { good: boolean; zh: string; en: string; es: string; useEn: string; useZh: string; useEs: string }> = {
  shengqi: { good: true, zh: '生气', en: 'Sheng Qi (vitality)', useEn: 'success, money and drive: best direction to face at your desk, for your front door, or in a negotiation', useZh: '事业、财运、冲劲：办公桌朝向、大门朝向、谈判时坐着面对的方向', es: 'Sheng Qi (vitalidad)', useEs: 'éxito, dinero e impulso: la mejor dirección para tu escritorio, la puerta principal o una negociación' },
  tianyi: { good: true, zh: '天医', en: 'Tian Yi (health)', useEn: 'health and recovery, and help from others: good for your bed head or for when you are unwell', useZh: '健康、贵人相助：床头朝向，身体不舒服时用', es: 'Tian Yi (salud)', useEs: 'salud, recuperación y ayuda de otros: buena para la cabecera de la cama o cuando no te sientes bien' },
  yannian: { good: true, zh: '延年', en: 'Yan Nian (relationships)', useEn: 'love, marriage and teamwork: good for the bedroom, dates and family time', useZh: '感情、婚姻、人缘：卧室、约会、家庭聚会', es: 'Yan Nian (relaciones)', useEs: 'amor, matrimonio y trabajo en equipo: buena para el dormitorio, las citas y el tiempo en familia' },
  fuwei: { good: true, zh: '伏位', en: 'Fu Wei (stability)', useEn: 'calm, study and steady progress: good for reading, meditation and exams', useZh: '稳定、学习、静心：读书、考试、冥想', es: 'Fu Wei (estabilidad)', useEs: 'calma, estudio y progreso constante: buena para leer, meditar y los exámenes' },
  huohai: { good: false, zh: '祸害', en: 'Huo Hai (mishaps)', useEn: 'small setbacks and disputes: fine for a bathroom or storage', useZh: '小麻烦、口舌：适合放卫生间、储物间', es: 'Huo Hai (contratiempos)', useEs: 'pequeños tropiezos y disputas: sirve para un baño o un almacén' },
  liusha: { good: false, zh: '六煞', en: 'Liu Sha (scandal)', useEn: 'messy relationships and gossip: avoid facing it in romance or legal matters', useZh: '感情是非、小人：谈感情、打官司时别朝这个方向', es: 'Liu Sha (escándalo)', useEs: 'relaciones enredadas y chismes: no la mires en asuntos de amor o legales' },
  wugui: { good: false, zh: '五鬼', en: 'Wu Gui (trouble)', useEn: 'accidents, fire and theft: keep it quiet, a good spot for the kitchen stove or a toilet', useZh: '意外、破财、火灾：适合放厨房灶台或卫生间，别放床和书桌', es: 'Wu Gui (problemas)', useEs: 'accidentes, fuego y robos: mantenla tranquila; buen sitio para la cocina o un baño' },
  jueming: { good: false, zh: '绝命', en: 'Jue Ming (worst)', useEn: 'the weakest direction: never sleep with your head this way or face it for big decisions', useZh: '最差的方向：床头别朝这边，做大决定时别面对这边', es: 'Jue Ming (la peor)', useEs: 'la dirección más débil: nunca duermas con la cabeza hacia aquí ni la mires en decisiones importantes' },
};
const STAR8_ORDER: Star8[] = ['shengqi', 'tianyi', 'yannian', 'fuwei', 'huohai', 'liusha', 'wugui', 'jueming'];
// directions for each Gua number in the order above
const KUA_TABLE: Record<number, Dir[]> = {
  1: ['SE', 'E', 'S', 'N', 'W', 'NW', 'NE', 'SW'],
  2: ['NE', 'W', 'NW', 'SW', 'E', 'S', 'SE', 'N'],
  3: ['S', 'N', 'SE', 'E', 'SW', 'NE', 'NW', 'W'],
  4: ['N', 'S', 'E', 'SE', 'NW', 'W', 'SW', 'NE'],
  6: ['W', 'NE', 'SW', 'NW', 'SE', 'N', 'E', 'S'],
  7: ['NW', 'SW', 'NE', 'W', 'N', 'SE', 'S', 'E'],
  8: ['SW', 'NW', 'W', 'NE', 'S', 'E', 'N', 'SE'],
  9: ['E', 'SE', 'N', 'S', 'NE', 'SW', 'W', 'NW'],
};
const TRIGRAM: Record<number, { zh: string; en: string }> = {
  1: { zh: '坎', en: 'Kan' }, 2: { zh: '坤', en: 'Kun' }, 3: { zh: '震', en: 'Zhen' }, 4: { zh: '巽', en: 'Xun' },
  6: { zh: '乾', en: 'Qian' }, 7: { zh: '兑', en: 'Dui' }, 8: { zh: '艮', en: 'Gen' }, 9: { zh: '离', en: 'Li' },
};
const EAST = new Set([1, 3, 4, 9]);
// a house is named after the direction its back sits toward
const SITTING_GUA: Record<Dir, number> = { N: 1, S: 9, E: 3, SE: 4, W: 7, NW: 6, NE: 8, SW: 2 };

export interface Kua {
  number: number; trigram: { zh: string; en: string }; group: 'east' | 'west';
  dirs: { star: Star8; dir: Dir }[];
}

// birthYear must be the Li Chun year (people born before about Feb 4 belong to the previous year)
export function kuaOf(birthYear: number, sex: Sex): Kua {
  let n = sex === 'm' ? mod9(2 - birthYear) : mod9(birthYear + 4);
  if (n === 5) n = sex === 'm' ? 2 : 8;
  return {
    number: n, trigram: TRIGRAM[n], group: EAST.has(n) ? 'east' : 'west',
    dirs: STAR8_ORDER.map((star, i) => ({ star, dir: KUA_TABLE[n][i] })),
  };
}
export const starOfDir = (k: Kua, d: Dir) => k.dirs.find((x) => x.dir === d)!.star;

// ---------- annual Flying Stars (年飞星) ----------

export const FLY: Record<number, { zh: string; en: string; es: string; tone: 'good' | 'neutral' | 'bad'; en2: string; zh2: string; es2: string; fixEn: string; fixZh: string; fixEs: string; query?: string }> = {
  1: { zh: '一白 贪狼', en: '1 White', es: '1 Blanco', tone: 'good', en2: 'career, new chances and romance', zh2: '事业、机会、桃花', fixEn: 'Boost with a small water feature or something blue or black.', fixZh: '放一个小水景，或蓝色、黑色的摆件，把好运带起来。', es2: 'carrera, nuevas oportunidades y romance', fixEs: 'Refuérzalo con una pequeña fuente de agua o algo azul o negro.', query: 'small tabletop water fountain' },
  2: { zh: '二黑 病符', en: '2 Black', es: '2 Negro', tone: 'bad', en2: 'illness and low energy', zh2: '生病、精神差', fixEn: 'Keep it calm; traditionally a brass gourd (wu lou) or metal items are placed here. Avoid red and avoid renovating it this year.', fixZh: '这里保持安静，传统上放铜葫芦或金属摆件来化；少用红色，今年别在这里动工装修。', es2: 'enfermedad y poca energía', fixEs: 'Mantenlo tranquilo; tradicionalmente se pone aquí una calabaza de latón (wu lou) u objetos de metal. Evita el rojo y no lo remodeles este año.', query: 'brass wu lou gourd feng shui' },
  3: { zh: '三碧 是非', en: '3 Jade', es: '3 Jade', tone: 'bad', en2: 'arguments and lawsuits', zh2: '吵架、官非', fixEn: 'Calm it with red or a touch of fire: a red rug, a warm lamp. Avoid loud activity here.', fixZh: '用红色或灯光来化：红色地毯、暖光台灯；这里别放音响，少在这里争论。', es2: 'discusiones y pleitos', fixEs: 'Cálmalo con rojo o un toque de fuego: una alfombra roja, una lámpara cálida. Evita actividades ruidosas aquí.', query: 'red area rug small' },
  4: { zh: '四绿 文昌', en: '4 Green', es: '4 Verde', tone: 'good', en2: 'study, exams and writing', zh2: '读书、考试、写作', fixEn: 'Good for a desk or study corner; add a plant or four stems of lucky bamboo in water.', fixZh: '适合放书桌，可以摆一盆绿植，或四枝富贵竹养在水里。', es2: 'estudio, exámenes y escritura', fixEs: 'Bueno para un escritorio o rincón de estudio; añade una planta o cuatro tallos de bambú de la suerte en agua.', query: 'lucky bamboo plant live' },
  5: { zh: '五黄 煞', en: '5 Yellow', es: '5 Amarillo', tone: 'bad', en2: 'the year\'s worst spot: accidents and losses', zh2: '全年最凶的位置：意外、破财', fixEn: 'Keep it quiet and uncluttered, no renovation or digging; traditionally a six-rod metal wind chime or a brass bell goes here.', fixZh: '这里保持安静整洁，今年千万别动工、打洞；传统上挂六管金属风铃或放铜铃来化。', es2: 'el peor punto del año: accidentes y pérdidas', fixEs: 'Mantenlo tranquilo y despejado, sin obras ni excavaciones; tradicionalmente aquí va un carillón de metal de seis tubos o una campana de latón.', query: 'six rod metal wind chime' },
  6: { zh: '六白 武曲', en: '6 White', es: '6 Blanco', tone: 'good', en2: 'authority, promotion and windfalls', zh2: '升职、权力、偏财', fixEn: 'Good for a home office; metal decor, white or gold, helps.', fixZh: '适合当书房或办公位，摆白色、金色或金属装饰会更好。', es2: 'autoridad, ascensos y ganancias inesperadas', fixEs: 'Bueno para una oficina en casa; ayuda la decoración de metal, blanca o dorada.', query: 'brass decorative bowl' },
  7: { zh: '七赤 破军', en: '7 Red', es: '7 Rojo', tone: 'bad', en2: 'theft, loss and gossip', zh2: '破财、被骗、口舌', fixEn: 'Calm it with still water or blue items; keep valuables elsewhere.', fixZh: '用一碗静水或蓝色物品来化，贵重物品别放这里。', es2: 'robos, pérdidas y chismes', fixEs: 'Cálmalo con agua quieta u objetos azules; guarda los objetos de valor en otro sitio.', query: 'blue glass vase' },
  8: { zh: '八白 财星', en: '8 White', es: '8 Blanco', tone: 'good', en2: 'wealth and property', zh2: '正财、房产', fixEn: 'Keep it bright, clean and used; a crystal or a bowl of coins is a traditional touch.', fixZh: '这里保持明亮干净、常有人走动；传统上摆一块水晶或一碗铜钱。', es2: 'riqueza y propiedades', fixEs: 'Mantenlo luminoso, limpio y en uso; un cristal o un cuenco con monedas es un toque tradicional.', query: 'citrine crystal cluster' },
  9: { zh: '九紫 喜庆', en: '9 Purple', es: '9 Púrpura', tone: 'good', en2: 'celebrations, fame and the strongest star of this era', zh2: '喜事、名气，也是当下这个运里最旺的星', fixEn: 'Light it up: a warm lamp, red or purple accents.', fixZh: '让这里亮起来：放暖光灯，加一些红色、紫色。', es2: 'celebraciones, fama y la estrella más fuerte de esta era', fixEs: 'Ilumínalo: una lámpara cálida, detalles rojos o morados.', query: 'warm table lamp' },
};

// Lo Shu flight path: center, NW, W, NE, S, N, SW, E, SE
const PATH: (Dir | 'C')[] = ['C', 'NW', 'W', 'NE', 'S', 'N', 'SW', 'E', 'SE'];
export function annualStars(year: number): Record<Dir | 'C', number> {
  const center = mod9(11 - year);
  const out = {} as Record<Dir | 'C', number>;
  PATH.forEach((p, i) => { out[p] = mod9(center + i); });
  return out;
}

// ---------- home facing check ----------

export interface HomeReading {
  facing: Dir; sitting: Dir; houseGua: number; houseGroup: 'east' | 'west'; match: boolean | null;
  facingStar: Star8 | null; doorStarThisYear: number; score: number; verdict: 'good' | 'neutral' | 'bad';
  notes: { en: string; zh: string; es: string }[];
}

export function readHome(facing: Dir, kua: Kua | null, favorable: Element[], year: number): HomeReading {
  const sitting = OPPOSITE[facing];
  const houseGua = SITTING_GUA[sitting];
  const houseGroup = EAST.has(houseGua) ? 'east' : 'west';
  const notes: { en: string; zh: string; es: string }[] = [];
  let score = 60;
  const match = kua ? kua.group === houseGroup : null;
  const g = (x: 'east' | 'west') => ({ en: x === 'east' ? 'East group' : 'West group', zh: x === 'east' ? '东四命' : '西四命', es: x === 'east' ? 'grupo Este' : 'grupo Oeste' });
  const gh = (x: 'east' | 'west') => ({ en: x === 'east' ? 'East group' : 'West group', zh: x === 'east' ? '东四宅' : '西四宅', es: x === 'east' ? 'grupo Este' : 'grupo Oeste' });
  if (kua) {
    if (match) { score += 15; notes.push({ en: `The house (sitting ${DIR_NAME[sitting].en}, ${gh(houseGroup).en}) matches you (${g(kua.group).en}).`, zh: `房子坐${DIR_NAME[sitting].zh}朝${DIR_NAME[facing].zh}，是${gh(houseGroup).zh}，和你的${g(kua.group).zh}相配。`, es: `La casa (asentada al ${DIR_NAME[sitting].es}, ${gh(houseGroup).es}) encaja contigo (${g(kua.group).es}).` }); }
    else { score -= 15; notes.push({ en: `The house is ${gh(houseGroup).en} but you are ${g(kua.group).en}, a mismatch; use your good directions for the bed and desk to make up for it.`, zh: `房子是${gh(houseGroup).zh}，你是${g(kua.group).zh}，不太相配；可以靠床头和书桌朝你的吉方来弥补。`, es: `La casa es del ${gh(houseGroup).es} pero tú eres del ${g(kua.group).es}, no encajan; compénsalo orientando la cama y el escritorio a tus buenas direcciones.` }); }
  }
  const facingStar = kua ? starOfDir(kua, facing) : null;
  if (facingStar) {
    const s = STAR8[facingStar];
    score += s.good ? 10 : -10;
    notes.push({ en: `The front faces your ${s.en} direction${s.good ? ', a good sign' : ', not ideal'}.`, zh: `大门朝向是你的${s.zh}方，${s.good ? '这是好方向' : '不太理想'}。`, es: `La puerta mira a tu dirección ${s.es}${s.good ? ', buena señal' : ', no es lo ideal'}.` });
  }
  const el = DIR_ELEMENT[facing];
  if (favorable.includes(el)) { score += 8; notes.push({ en: `Facing ${DIR_NAME[facing].en} (${ELEMENT_NAME[el].en}) supports your favorable element.`, zh: `朝${DIR_NAME[facing].zh}属${ELEMENT_NAME[el].zh}，正好是你的喜用五行。`, es: `Mirar al ${DIR_NAME[facing].es} (${ELEMENT_NAME[el].es}) apoya tu elemento favorable.` }); }
  const ds = annualStars(year)[facing];
  const f = FLY[ds];
  score += f.tone === 'good' ? 5 : f.tone === 'bad' ? -8 : 0;
  notes.push({ en: `This year the ${f.en} star (${f.en2}) sits at the front door. ${f.fixEn}`, zh: `今年大门方位飞到${f.zh}（${f.zh2}）。${f.fixZh}`, es: `Este año la estrella ${f.es} (${f.es2}) está en la puerta principal. ${f.fixEs}` });
  score = Math.max(0, Math.min(100, score));
  return { facing, sitting, houseGua, houseGroup, match, facingStar, doorStarThisYear: ds, score, verdict: score >= 68 ? 'good' : score >= 52 ? 'neutral' : 'bad', notes };
}

// ---------- context for FateBot ----------

export function fengshuiContext(birthYear: number, sex: Sex | undefined, favorable: Element[], now = new Date()) {
  const y = liChunYear(now);
  const stars = (yy: number) => {
    const s = annualStars(yy);
    return Object.fromEntries((Object.keys(s) as (Dir | 'C')[]).map((k) => [k === 'C' ? 'center' : DIR_NAME[k as Dir].en, `${FLY[s[k]].zh} (${FLY[s[k]].en}): ${FLY[s[k]].en2}; ${FLY[s[k]].tone}; remedy: ${FLY[s[k]].fixEn}`]));
  };
  const kua = sex ? kuaOf(birthYear, sex) : null;
  return {
    personalDirections: kua
      ? { gua: `${kua.number} ${kua.trigram.zh} (${kua.trigram.en})`, group: kua.group === 'east' ? 'East group 东四命' : 'West group 西四命', directions: kua.dirs.map((d) => `${DIR_NAME[d.dir].en} ${DIR_NAME[d.dir].zh}: ${STAR8[d.star].zh} ${STAR8[d.star].en}, ${STAR8[d.star].good ? 'good' : 'bad'}; ${STAR8[d.star].useEn}`) }
      : 'unknown: sex not set. Ask the person to choose it in the Feng Shui tab for personal directions.',
    favorableElementDirections: DIRS.filter((d) => favorable.includes(DIR_ELEMENT[d])).map((d) => `${DIR_NAME[d].en} ${DIR_NAME[d].zh} (${ELEMENT_NAME[DIR_ELEMENT[d]].en})`),
    flyingStars: { year: `${y} ${yearGanZhi(y)} (from Li Chun, about Feb 4)`, sectors: stars(y) },
    flyingStarsNextYear: { year: `${y + 1} ${yearGanZhi(y + 1)} (starts about Feb 4, ${y + 1})`, sectors: stars(y + 1) },
  };
}
