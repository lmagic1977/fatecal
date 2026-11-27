import { Solar } from 'lunar-javascript';
import { BRANCH, ELEMENT_NAME, STEM, branchRelation, type Chart, type Element } from './engine';
import type { Lang } from './i18n';

// Today's life tips: what kind of day it is for this chart, lucky / unlucky directions,
// what to do, and simple traditional remedies. All rule-based (no AI), so it is instant and free.

type L3 = { en: string; zh: string; es: string; pt: string };
const pick = (t: L3, lang: Lang) => t[lang];

const DIR: Record<string, L3> = {
  正东: { en: 'East', zh: '正东', es: 'Este', pt: 'Leste' }, 正南: { en: 'South', zh: '正南', es: 'Sur', pt: 'Sul' }, 正西: { en: 'West', zh: '正西', es: 'Oeste', pt: 'Oeste' }, 正北: { en: 'North', zh: '正北', es: 'Norte', pt: 'Norte' },
  东: { en: 'East', zh: '东', es: 'Este', pt: 'Leste' }, 南: { en: 'South', zh: '南', es: 'Sur', pt: 'Sul' }, 西: { en: 'West', zh: '西', es: 'Oeste', pt: 'Oeste' }, 北: { en: 'North', zh: '北', es: 'Norte', pt: 'Norte' },
  东南: { en: 'Southeast', zh: '东南', es: 'Sureste', pt: 'Sudeste' }, 西南: { en: 'Southwest', zh: '西南', es: 'Suroeste', pt: 'Sudoeste' }, 东北: { en: 'Northeast', zh: '东北', es: 'Noreste', pt: 'Nordeste' }, 西北: { en: 'Northwest', zh: '西北', es: 'Noroeste', pt: 'Noroeste' },
};
const dir = (d: string, lang: Lang) => (DIR[d] ? pick(DIR[d], lang) : d);

const ANIMAL: Record<string, L3> = {
  鼠: { en: 'Rat', zh: '鼠', es: 'Rata', pt: 'Rato' }, 牛: { en: 'Ox', zh: '牛', es: 'Buey', pt: 'Boi' }, 虎: { en: 'Tiger', zh: '虎', es: 'Tigre', pt: 'Tigre' }, 兔: { en: 'Rabbit', zh: '兔', es: 'Conejo', pt: 'Coelho' },
  龙: { en: 'Dragon', zh: '龙', es: 'Dragón', pt: 'Dragão' }, 蛇: { en: 'Snake', zh: '蛇', es: 'Serpiente', pt: 'Serpente' }, 马: { en: 'Horse', zh: '马', es: 'Caballo', pt: 'Cavalo' }, 羊: { en: 'Goat', zh: '羊', es: 'Cabra', pt: 'Cabra' },
  猴: { en: 'Monkey', zh: '猴', es: 'Mono', pt: 'Macaco' }, 鸡: { en: 'Rooster', zh: '鸡', es: 'Gallo', pt: 'Galo' }, 狗: { en: 'Dog', zh: '狗', es: 'Perro', pt: 'Cão' }, 猪: { en: 'Pig', zh: '猪', es: 'Cerdo', pt: 'Porco' },
};

const COLOR: Record<Element, L3> = {
  wood: { en: 'green', zh: '绿色', es: 'verde', pt: 'verde' }, fire: { en: 'red or purple', zh: '红色、紫色', es: 'rojo o morado', pt: 'vermelho ou roxo' },
  earth: { en: 'yellow or brown', zh: '黄色、咖啡色', es: 'amarillo o marrón', pt: 'amarelo ou marrom' }, metal: { en: 'white, gold or silver', zh: '白色、金色、银色', es: 'blanco, dorado o plateado', pt: 'branco, dourado ou prateado' },
  water: { en: 'black or navy blue', zh: '黑色、深蓝色', es: 'negro o azul marino', pt: 'preto ou azul-marinho' },
};
const NUMBERS: Record<Element, string> = { water: '1, 6', fire: '2, 7', wood: '3, 8', metal: '4, 9', earth: '5, 0' };
const ITEM: Record<Element, L3> = {
  wood: { en: 'a green plant on your desk or a wooden bead bracelet', zh: '桌上放一盆绿植，或戴木质手串', es: 'una planta verde en tu escritorio o una pulsera de madera', pt: 'uma planta verde na sua mesa ou uma pulseira de madeira' },
  fire: { en: 'something red, a candle, or 10 minutes of sunshine', zh: '带一件红色小物、点一支蜡烛，或晒 10 分钟太阳', es: 'algo rojo, una vela o 10 minutos de sol', pt: 'algo vermelho, uma vela ou 10 minutos de sol' },
  earth: { en: 'a ceramic cup, a crystal or a yellow item', zh: '用陶瓷杯，带一块水晶或黄色小物', es: 'una taza de cerámica, un cristal o algo amarillo', pt: 'uma caneca de cerâmica, um cristal ou algo amarelo' },
  metal: { en: 'a metal watch, a coin, or white or gold accessories', zh: '戴金属手表、带一枚硬币，或白色、金色饰品', es: 'un reloj de metal, una moneda o accesorios blancos o dorados', pt: 'um relógio de metal, uma moeda ou acessórios brancos ou dourados' },
  water: { en: 'drink more water, wear black or blue, or keep a small fountain or fish bowl nearby', zh: '多喝水，穿黑色或蓝色，或在身边放一个小水景、鱼缸', es: 'bebe más agua, viste negro o azul, o ten una pequeña fuente o pecera cerca', pt: 'beba mais água, vista preto ou azul, ou tenha uma pequena fonte ou aquário por perto' },
};

const GEN: Record<Element, Element> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const CTL: Record<Element, Element> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

export interface DailyTips {
  dayGz: string;
  kind: string;          // what kind of day it is for you (element relation)
  branchNote?: string;   // clash / harmony with your year or day branch
  lucky: { label: string; dir: string; raw: string }[];
  shaRaw: string;
  avoidDir: string;
  clashAnimal: string;   // people of this zodiac should keep a low profile
  colors: string; numbers: string; item: string;
  remedies: string[];
}

export function dailyTips(chart: Chart, date: Date, verdict: 'good' | 'mixed' | 'poor' | string, lang: Lang, word?: string): DailyTips {
  const W = word || (lang === 'zh' ? '今天' : lang === 'es' ? 'Hoy' : 'Today');
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const lunar = Solar.fromDate(noon).getLunar();
  const gz = lunar.getDayInGanZhi();
  const dEl = STEM[gz[0]].el, me = chart.dayMasterElement;
  const t = (en: string, zh: string, es: string, pt?: string) => (lang === 'zh' ? zh : lang === 'es' ? es : lang === 'pt' ? (pt ?? es) : en);
  const E = (e: Element) => ELEMENT_NAME[e][lang];
  const fav = chart.favorable.includes(dEl);

  let kind: string;
  if (dEl === me) kind = t(`A ${E(dEl)} day, the same element as you: friends and teamwork help, but don't be stubborn.`, `${W}是${E(dEl)}日，和你的日主同五行：朋友、同事帮得上忙，但别太固执。`, `Día de ${E(dEl)}, tu mismo elemento: amigos y equipo ayudan, pero no seas terco.`, `Dia de ${E(dEl)}, o mesmo elemento que você: amigos e equipe ajudam, mas não seja teimoso.`);
  else if (GEN[dEl] === me) kind = t(`A ${E(dEl)} day that feeds your ${E(me)}: good for learning, getting help and support.`, `${W}是${E(dEl)}日，${E(dEl)}生${E(me)}，生扶你：适合学习、求助、找贵人。`, `Día de ${E(dEl)} que nutre tu ${E(me)}: bueno para aprender y pedir apoyo.`, `Dia de ${E(dEl)} que nutre seu ${E(me)}: bom para aprender e pedir apoio.`);
  else if (GEN[me] === dEl) kind = t(`A ${E(dEl)} day: your ${E(me)} feeds it, so you give out energy. Good for creating and showing your work; rest enough.`, `${W}是${E(dEl)}日，${E(me)}生${E(dEl)}，是你付出的一天：适合创作、表达、展示成果，注意别太累。`, `Día de ${E(dEl)}: tu ${E(me)} lo alimenta, das energía. Bueno para crear y mostrar tu trabajo; descansa.`, `Dia de ${E(dEl)}: seu ${E(me)} o alimenta, você doa energia. Bom para criar e mostrar seu trabalho; descanse.`);
  else if (CTL[me] === dEl) kind = t(`A ${E(dEl)} day that your ${E(me)} controls: a money day. Good for deals, sales and getting paid, if you stay focused.`, `${W}是${E(dEl)}日，${E(me)}克${E(dEl)}，是「财」日：适合谈生意、收款、成交，专注就有收获。`, `Día de ${E(dEl)} que tu ${E(me)} controla: día de dinero. Bueno para negocios y cobros si te enfocas.`, `Dia de ${E(dEl)} que seu ${E(me)} controla: dia de dinheiro. Bom para negócios e recebimentos se você se concentrar.`);
  else kind = t(`A ${E(dEl)} day that presses on your ${E(me)}: a day of pressure and rules. Do things by the book, keep a low profile, and good discipline pays off.`, `${W}是${E(dEl)}日，${E(dEl)}克${E(me)}，是「官杀」日：压力和规矩多，按规矩办事、低调一点，自律反而有回报。`, `Día de ${E(dEl)} que presiona tu ${E(me)}: presión y reglas. Sigue las normas y mantén un perfil bajo.`, `Dia de ${E(dEl)} que pressiona seu ${E(me)}: pressão e regras. Siga as normas e mantenha a discrição.`);
  kind += ' ' + (fav ? t(`${E(dEl)} is one of your lucky elements, so it leans in your favor.`, `${E(dEl)}正是你的喜用神，整体对你有利。`, `${E(dEl)} es uno de tus elementos favorables: te favorece.`, `${E(dEl)} é um dos seus elementos favoráveis: te favorece.`)
    : t(`${E(dEl)} isn't one of your lucky elements, so go steady.`, `${E(dEl)}不是你的喜用神，稳一点更好。`, `${E(dEl)} no es de tus elementos favorables: ve con calma.`, `${E(dEl)} não é um dos seus elementos favoráveis: vá com calma.`));

  const dBr = gz[1];
  let branchNote: string | undefined;
  let clash = false;
  const rel = (b: string) => branchRelation(dBr, b);
  if (rel(chart.dayBranch) === 'clash' || rel(chart.yearBranch) === 'clash') {
    clash = true;
    const which = rel(chart.dayBranch) === 'clash' ? t('your day pillar (self and partner)', '你的日支（自己、配偶宫）', 'tu pilar del día (tú y tu pareja)', 'seu pilar do dia (você e seu par)') : t('your birth-year animal', '你的生肖（年支）', 'tu animal del año', 'seu animal do ano');
    branchNote = t(`${W}'s ${BRANCH[dBr].animal} clashes with ${which}: expect changes and friction. Avoid big moves and arguments; double-check plans.`, `${W}的日支${dBr}冲${which}：容易有变动、摩擦。避免大动作和争执，计划多确认一遍。`, `El ${ANIMAL[BRANCH[dBr].zh]?.es ?? dBr} del día choca con ${which}: cambios y roces. Evita grandes movimientos y discusiones.`, `O ${ANIMAL[BRANCH[dBr].zh]?.pt ?? dBr} do dia choca com ${which}: mudanças e atritos. Evite grandes movimentos e discussões.`);
  } else if (['harmony', 'trine'].includes(rel(chart.dayBranch)) || ['harmony', 'trine'].includes(rel(chart.yearBranch))) {
    branchNote = t(`${W}'s ${BRANCH[dBr].animal} harmonizes with your chart: people are easier to work with.`, `${W}的日支${dBr}和你的命盘相合：人缘好，沟通顺。`, `El día armoniza con tu carta: la gente es más fácil de tratar.`, `O dia harmoniza com seu mapa: as pessoas ficam mais fáceis de lidar.`);
  }

  const lucky = [
    { label: t('Joy (喜神)', '喜神', 'Alegría (喜神)', 'Alegria (喜神)'), dir: dir(lunar.getDayPositionXiDesc(), lang), raw: lunar.getDayPositionXiDesc() },
    { label: t('Wealth (财神)', '财神', 'Riqueza (财神)', 'Riqueza (财神)'), dir: dir(lunar.getDayPositionCaiDesc(), lang), raw: lunar.getDayPositionCaiDesc() },
    { label: t('Blessing (福神)', '福神', 'Bendición (福神)', 'Bênção (福神)'), dir: dir(lunar.getDayPositionFuDesc(), lang), raw: lunar.getDayPositionFuDesc() },
  ];
  const sha = lunar.getDaySha();
  const avoidDir = dir(sha, lang);
  const clashA = lunar.getDayChongShengXiao();
  const clashAnimal = ANIMAL[clashA] ? pick(ANIMAL[clashA], lang) : clashA;

  const f1 = chart.favorable[0], f2 = chart.favorable[1] ?? chart.favorable[0];
  const colors = f1 === f2 ? COLOR[f1][lang] : `${COLOR[f1][lang]}${t(' or ', '，或', ' o ', ' ou ')}${COLOR[f2][lang]}`;
  const numbers = [...new Set([...NUMBERS[f1].split(', '), ...NUMBERS[f2].split(', ')])].join(', ');
  const item = ITEM[f1][lang];

  const remedies: string[] = [];
  remedies.push(t(`Wear or carry your lucky color ${W === 'Today' ? 'today' : W.toLowerCase()}: ${colors}.`, `${W}穿戴你的幸运色：${colors}。`, `Usa tu color de suerte: ${colors}.`, `Use sua cor da sorte: ${colors}.`));
  remedies.push(t(`Boost your lucky element (${E(f1)}): ${item}.`, `补你的喜用神（${E(f1)}）：${item}。`, `Refuerza tu elemento (${E(f1)}): ${item}.`, `Reforce seu elemento (${E(f1)}): ${item}.`));
  remedies.push(t(`For money matters, face or head ${lucky[1].dir}; for mood and relationships, ${lucky[0].dir}.`, `谈钱的事，坐或走向${lucky[1].dir}（财神方）；求人缘、心情，往${lucky[0].dir}（喜神方）。`, `Para dinero, mira o ve hacia el ${lucky[1].dir}; para ánimo y relaciones, hacia el ${lucky[0].dir}.`, `Para dinheiro, fique de frente ou vá para o ${lucky[1].dir}; para ânimo e relações, para o ${lucky[0].dir}.`));
  remedies.push(t(`Don't start important things facing ${avoidDir} (the day's sha direction).`, `重要的事不要面朝${avoidDir}（当日煞方）开始。`, `No empieces cosas importantes mirando al ${avoidDir} (dirección sha del día).`, `Não comece coisas importantes de frente para o ${avoidDir} (direção sha do dia).`));
  if (verdict !== 'good' || clash) {
    remedies.push(t('If things feel stuck: move key decisions into your best hours, take a short walk toward your Joy direction, and keep your words gentle.', '如果觉得不顺：把重要决定挪到最顺的时段，往喜神方向走一走，说话放软一点。', 'Si algo se traba: pasa las decisiones a tus mejores horas, camina un poco hacia la dirección de Alegría y habla con suavidad.', 'Se algo travar: passe as decisões para seus melhores horários, caminhe um pouco na direção da Alegria e fale com suavidade.'));
  }

  return { shaRaw: sha, dayGz: gz, kind, branchNote, lucky, avoidDir, clashAnimal, colors, numbers, item, remedies };
}
