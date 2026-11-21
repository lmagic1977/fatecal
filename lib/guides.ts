import { Lunar } from 'lunar-javascript';
import type { L } from './goodDays';

// Evergreen SEO guides (en / zh / es). Text is written as cultural tradition, never as a promise.
export const GUIDE_SLUGS = ['what-is-bazi', 'year-of-the-fire-goat-2027', 'chinese-zodiac'] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
const ANIMAL_ZH = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const ANIMAL_ES = ['Rata', 'Buey', 'Tigre', 'Conejo', 'Dragón', 'Serpiente', 'Caballo', 'Cabra', 'Mono', 'Gallo', 'Perro', 'Cerdo'];
const EL = { en: ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'], zh: ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'], es: ['Madera', 'Madera', 'Fuego', 'Fuego', 'Tierra', 'Tierra', 'Metal', 'Metal', 'Agua', 'Agua'] };
export const animalName = (i: number, l: L) => (l === 'zh' ? ANIMAL_ZH[i] : l === 'es' ? ANIMAL_ES[i] : ANIMALS[i]);

// Zodiac year table: Chinese New Year date, animal and element for each year
export function zodiacYears(from = 1930, to = 2035) {
  return Array.from({ length: to - from + 1 }, (_, k) => {
    const y = from + k, lny = Lunar.fromYmd(y, 1, 1).getSolar();
    const a = ((y - 4) % 12 + 12) % 12, e = ((y - 4) % 10 + 10) % 10;
    return { y, start: lny.toYmd(), a, e };
  });
}
export const elementName = (e: number, l: L) => EL[l][e];

// 2027 丁未: traditional relationships of each sign with the year (太岁)
export const GOAT_2027: Record<number, { tag: Record<L, string>; tone: 'good' | 'mixed' | 'care' }> = {
  7: { tone: 'care', tag: { en: 'Your own year (běn mìng nián): tradition says move steadily and avoid big gambles; red is the classic lucky color.', zh: '本命年（值太岁）：传统上讲求稳，少冒大险；红色是传统的吉祥色。', es: 'Tu propio año (běn mìng nián): la tradición aconseja avanzar con calma y evitar grandes apuestas; el rojo es el color de la suerte.' } },
  1: { tone: 'care', tag: { en: 'Clashes with the year (Ox–Goat clash): expect change; plan big moves carefully and leave buffer time.', zh: '冲太岁（丑未相冲）：变动较多，大事多做准备，时间上留余地。', es: 'Choca con el año (Buey–Cabra): espera cambios; planifica con cuidado y deja margen de tiempo.' } },
  10: { tone: 'care', tag: { en: 'Punishes and breaks the year (Dog–Goat): small frictions; keep agreements in writing.', zh: '刑太岁、破太岁（戌未）：小摩擦多，约定最好白纸黑字。', es: 'Castiga y rompe el año (Perro–Cabra): pequeños roces; deja los acuerdos por escrito.' } },
  0: { tone: 'care', tag: { en: 'Harms the year (Rat–Goat): watch for misunderstandings with colleagues and friends.', zh: '害太岁（子未相害）：注意人际误会，多沟通。', es: 'Perjudica al año (Rata–Cabra): cuidado con malentendidos con colegas y amigos.' } },
  6: { tone: 'good', tag: { en: 'Combines with the year (Horse–Goat harmony): a cooperative year; good for partnerships.', zh: '六合太岁（午未相合）：贵人多，合作顺。', es: 'Se combina con el año (Caballo–Cabra): un año de cooperación; bueno para asociarse.' } },
  3: { tone: 'good', tag: { en: 'In a trine with the year (Pig–Rabbit–Goat): support from your circle.', zh: '三合太岁（亥卯未）：身边容易得到帮助。', es: 'En trígono con el año (Cerdo–Conejo–Cabra): apoyo de tu entorno.' } },
  11: { tone: 'good', tag: { en: 'In a trine with the year (Pig–Rabbit–Goat): support from your circle.', zh: '三合太岁（亥卯未）：身边容易得到帮助。', es: 'En trígono con el año (Cerdo–Conejo–Cabra): apoyo de tu entorno.' } },
};
export const NEUTRAL_2027: Record<L, string> = { en: 'No special relationship with the year: a steady background; your own BaZi chart matters more.', zh: '与太岁无特别关系：整体平稳，更要看自己的八字。', es: 'Sin relación especial con el año: un fondo estable; tu carta BaZi importa más.' };

type Section = { h: string; p: string[] };
export interface Guide { title: string; desc: string; h1: string; lead: string; sections: Section[] }

export const GUIDES: Record<GuideSlug, Record<L, Guide>> = {
  'what-is-bazi': {
    en: {
      title: 'What Is BaZi? Chinese Four Pillars Astrology Explained | FateCal',
      desc: 'BaZi (Four Pillars of Destiny) explained simply: the eight characters, the five elements, your Day Master, and how BaZi is used to choose good days and hours.',
      h1: 'What is BaZi? The Four Pillars of Destiny, explained simply',
      lead: 'BaZi (八字, "eight characters") is a Chinese astrology system that turns the year, month, day and hour of your birth into four pillars of two characters each. It is over a thousand years old and is still widely used to choose dates for weddings, moves and business openings.',
      sections: [
        { h: 'The four pillars and eight characters', p: ['Each pillar is a pair: a heavenly stem on top and an earthly branch below. The year pillar describes your roots and family, the month pillar your upbringing and career environment, the day pillar you yourself, and the hour pillar your later years and long-term plans.', 'The earthly branches are the twelve animals many people know from the Chinese zodiac. Your zodiac animal is simply the branch of your year pillar.'] },
        { h: 'The five elements', p: ['Every character belongs to one of five elements: wood, fire, earth, metal and water. They support each other in a cycle (wood feeds fire, fire makes earth, earth bears metal, metal carries water, water nourishes wood) and restrain each other in another.', 'Counting the elements in your chart shows which are strong and which are scarce. The elements that bring your chart into balance are called your favorable elements.'] },
        { h: 'Your Day Master', p: ['The top character of your day pillar is your Day Master: the element that represents you. A strong Day Master is helped by elements that use its energy (expression, wealth, authority); a weak one by elements that feed it (resources, peers).'] },
        { h: 'How BaZi is used for timing', p: ['Every year, month, day and two-hour block also has its own pillar. When that pillar supports your chart, things tend to feel smoother; when it clashes with your day branch, plans are more likely to change. Combined with the traditional almanac (黄历), which lists what each day suits and should avoid, this is how date selection (择日) works.', 'FateCal does this automatically: it reads your calendar, scores each plan against your chart and the almanac, and suggests a better slot when one does not suit you.'] },
        { h: 'Is BaZi scientific?', p: ['No. BaZi is a cultural tradition, not a science, and there is no evidence that it predicts outcomes. Many people use it as a thoughtful second look at their plans and a reason to prepare well. Real-world facts and professional advice should always come first.'] },
      ],
    },
    zh: {
      title: '什么是八字？四柱八字入门：天干地支、五行、日主 | 随身吉历',
      desc: '一篇讲清楚八字（四柱）：八个字怎么来、五行生克、日主强弱，以及八字怎样用来择日、挑好时辰。',
      h1: '什么是八字？一文看懂四柱八字',
      lead: '八字，就是把一个人出生的年、月、日、时，各换成一对天干地支，一共四柱八个字。这套方法流传一千多年，至今很多人结婚、搬家、开业都会用它来选日子。',
      sections: [
        { h: '四柱与八个字', p: ['每一柱由上面的天干和下面的地支组成。年柱代表祖上和童年，月柱代表成长和事业环境，日柱代表自己，时柱代表晚年和长远规划。', '地支就是大家熟悉的十二生肖，你的属相就是年柱的地支。'] },
        { h: '五行生克', p: ['每个字都属于金、木、水、火、土中的一种。五行相生：木生火、火生土、土生金、金生水、水生木；也相克：木克土、土克水、水克火、火克金、金克木。', '数一数命盘里的五行，就知道哪个多、哪个少。能让命盘更平衡的五行，叫"喜用神"。'] },
        { h: '日主：代表你自己', p: ['日柱的天干叫"日主"，代表你本人。日主强的人，适合用掉能量的五行（食伤、财、官）；日主弱的人，适合生扶它的五行（印、比劫）。'] },
        { h: '八字怎么用来择日', p: ['每一年、每个月、每一天、每个时辰都有自己的干支。它和你的命盘相生相合，做事就顺；和你的日支相冲，计划容易变。再结合老黄历每天的「宜」「忌」，就是传统的择日方法。', '随身吉历把这一套自动化了：读取你的日程，按八字和黄历给每件事打分，不合适的时候推荐更好的日子和时辰。'] },
        { h: '八字科学吗？', p: ['不是。八字是传统文化，不是科学，也没有证据证明它能预测结果。很多人把它当作对计划的"第二次检查"，提醒自己做好准备。实际情况和专业意见永远优先。'] },
      ],
    },
    es: {
      title: '¿Qué es el BaZi? La astrología china de los Cuatro Pilares | FateCal',
      desc: 'El BaZi (Cuatro Pilares del Destino) explicado de forma sencilla: los ocho caracteres, los cinco elementos, tu Maestro del Día y cómo se usa para elegir buenos días y horas.',
      h1: '¿Qué es el BaZi? Los Cuatro Pilares del Destino, explicados',
      lead: 'El BaZi (八字, «ocho caracteres») es un sistema de astrología china que convierte el año, mes, día y hora de tu nacimiento en cuatro pilares de dos caracteres. Tiene más de mil años y aún se usa mucho para elegir fechas de bodas, mudanzas e inauguraciones.',
      sections: [
        { h: 'Los cuatro pilares y los ocho caracteres', p: ['Cada pilar es un par: un tronco celeste arriba y una rama terrestre abajo. El pilar del año habla de tus raíces y familia, el del mes de tu crianza y entorno laboral, el del día de ti, y el de la hora de tus años posteriores y planes a largo plazo.', 'Las ramas terrestres son los doce animales del zodiaco chino. Tu animal es la rama de tu pilar del año.'] },
        { h: 'Los cinco elementos', p: ['Cada carácter pertenece a uno de cinco elementos: madera, fuego, tierra, metal y agua. Se nutren en un ciclo (la madera alimenta el fuego, el fuego crea tierra, la tierra genera metal, el metal lleva agua, el agua nutre la madera) y se controlan en otro.', 'Contar los elementos de tu carta muestra cuáles abundan y cuáles faltan. Los que equilibran tu carta son tus elementos favorables.'] },
        { h: 'Tu Maestro del Día', p: ['El carácter de arriba de tu pilar del día es tu Maestro del Día: el elemento que te representa. Un Maestro fuerte se beneficia de elementos que usan su energía; uno débil, de los que lo nutren.'] },
        { h: 'Cómo se usa para elegir el momento', p: ['Cada año, mes, día y bloque de dos horas tiene su propio pilar. Cuando apoya tu carta, las cosas suelen fluir; cuando choca con tu rama del día, los planes tienden a cambiar. Junto con el almanaque tradicional (黄历), así funciona la elección de fechas (择日).', 'FateCal lo hace automáticamente: lee tu calendario, puntúa cada plan según tu carta y el almanaque, y sugiere un mejor horario cuando no te conviene.'] },
        { h: '¿Es científico?', p: ['No. El BaZi es una tradición cultural, no una ciencia, y no hay evidencia de que prediga resultados. Muchas personas lo usan como una segunda mirada a sus planes. Los hechos reales y el consejo profesional siempre van primero.'] },
      ],
    },
  },
  'year-of-the-fire-goat-2027': {
    en: {
      title: '2027 Year of the Fire Goat: Dates, Meaning and Your Zodiac Sign | FateCal',
      desc: 'The Chinese Year of the Fire Goat starts on February 6, 2027. What Fire Goat (丁未) means, which zodiac signs clash or combine with it, and how to plan your year.',
      h1: '2027 Year of the Fire Goat (丁未): dates, meaning and your sign',
      lead: 'Chinese New Year 2027 falls on Saturday, February 6, 2027, starting the Year of the Fire Goat (丁未, Ding Wei). It runs until January 25, 2028. In BaZi and feng shui, the year is often counted from Li Chun (立春), around February 4, 2027.',
      sections: [
        { h: 'What "Fire Goat" means', p: ['Each year pairs one of ten heavenly stems with one of twelve animals. 2027 pairs 丁 (yin fire, a candle-like, warm and focused fire) with 未 (the Goat, an earth branch). Traditionally that suggests a year that rewards care, craft and kindness more than force. The last Fire Goat year was 1967.'] },
        { h: 'How each zodiac sign relates to 2027', p: ['In tradition, how your animal relates to the year\'s animal (Tai Sui, 太岁) colors the year. See the table below. These are general notes for everyone born in that year; your full BaZi chart says much more.'] },
        { h: 'Planning your year', p: ['Use the general good days for big dates, then check them against your own chart. FateCal does both at once: it scores each plan in your calendar for you and suggests better days.'] },
      ],
    },
    zh: {
      title: '2027 火羊年（丁未年）：日期、含义与十二生肖运势 | 随身吉历',
      desc: '2027 年农历新年是 2 月 6 日，进入丁未火羊年。丁未是什么意思？哪些生肖犯太岁、哪些生肖相合？一篇看懂。',
      h1: '2027 丁未火羊年：日期、含义与十二生肖',
      lead: '2027 年春节是 2 月 6 日（星期六），从这天起进入丁未火羊年，到 2028 年 1 月 25 日结束。八字和风水里，通常以立春（2027 年 2 月 4 日）作为新一年的开始。',
      sections: [
        { h: '「丁未火羊」是什么意思', p: ['每一年由十天干之一配上十二地支之一。2027 年是「丁」（阴火，像烛火一样温暖、专注）配「未」（羊，属土）。传统上认为，这一年更奖励用心、手艺和温和，而不是硬拼。上一个丁未年是 1967 年。'] },
        { h: '十二生肖与 2027 太岁的关系', p: ['传统上，你的生肖和当年生肖（太岁）的关系，会影响这一年的整体感觉，见下表。这是同一年出生的人都适用的大方向，你自己的八字能看得更细。'] },
        { h: '怎么安排这一年', p: ['重要的日子先参考黄道吉日，再对照自己的八字。随身吉历一步到位：按你的八字给日程里每件事打分，并推荐更好的日子。'] },
      ],
    },
    es: {
      title: '2027, Año de la Cabra de Fuego: fechas, significado y tu signo | FateCal',
      desc: 'El Año Nuevo chino de 2027 es el 6 de febrero y empieza el Año de la Cabra de Fuego (丁未). Qué significa, qué signos chocan o se combinan con él y cómo planificar tu año.',
      h1: '2027, Año de la Cabra de Fuego (丁未): fechas, significado y tu signo',
      lead: 'El Año Nuevo chino de 2027 cae el sábado 6 de febrero de 2027 y empieza el Año de la Cabra de Fuego (丁未, Ding Wei), que dura hasta el 25 de enero de 2028. En BaZi y feng shui, el año suele contarse desde Li Chun (立春), hacia el 4 de febrero de 2027.',
      sections: [
        { h: 'Qué significa «Cabra de Fuego»', p: ['Cada año combina uno de diez troncos celestes con uno de doce animales. 2027 une 丁 (fuego yin, cálido y concentrado como una vela) con 未 (la Cabra, rama de tierra). Tradicionalmente sugiere un año que premia el cuidado, el oficio y la amabilidad más que la fuerza. La última Cabra de Fuego fue en 1967.'] },
        { h: 'Cómo se relaciona cada signo con 2027', p: ['En la tradición, la relación de tu animal con el del año (Tai Sui, 太岁) marca el tono del año. Mira la tabla. Son notas generales para todos los nacidos ese año; tu carta BaZi completa dice mucho más.'] },
        { h: 'Planifica tu año', p: ['Usa los días propicios generales para las fechas importantes y luego compáralos con tu propia carta. FateCal hace ambas cosas: puntúa cada plan de tu calendario y sugiere mejores días.'] },
      ],
    },
  },
  'chinese-zodiac': {
    en: {
      title: 'Chinese Zodiac by Year: What\'s My Chinese Zodiac Animal? (1930–2035) | FateCal',
      desc: 'Find your Chinese zodiac animal and element by birth year, with the exact Chinese New Year date for every year from 1930 to 2035. Born in January or February? Check the date.',
      h1: 'Chinese zodiac by year: find your animal and element',
      lead: 'Your Chinese zodiac animal comes from your birth year, but the Chinese year starts on Chinese New Year (late January to mid February), not January 1. If you were born before that date, you belong to the previous year\'s animal.',
      sections: [
        { h: 'The twelve animals', p: ['Rat, Ox, Tiger, Rabbit, Dragon, Snake, Horse, Goat, Monkey, Rooster, Dog and Pig repeat every 12 years. Each year also has an element (wood, fire, earth, metal or water), which repeats every 10 years, making a 60-year cycle.'] },
        { h: 'Your animal is only one of eight characters', p: ['The animal is the branch of your year pillar. Your full BaZi chart has eight characters, and the day pillar, not the year, represents you. That is why two people with the same animal can be very different.'] },
      ],
    },
    zh: {
      title: '生肖查询：出生年份对照表（1930–2035），属什么一查便知 | 随身吉历',
      desc: '按出生年份查生肖和五行，附 1930 至 2035 年每年春节的准确日期。一二月出生的人注意：春节前出生算上一年的生肖。',
      h1: '生肖查询：出生年份对照表',
      lead: '生肖按出生年份来算，但农历新年是从春节开始（公历 1 月下旬到 2 月中旬），不是 1 月 1 日。如果你在当年春节之前出生，生肖要算上一年的。（八字和风水通常以立春为界，一般在 2 月 4 日前后。）',
      sections: [
        { h: '十二生肖', p: ['鼠、牛、虎、兔、龙、蛇、马、羊、猴、鸡、狗、猪，十二年一轮。每年还有一个五行（木、火、土、金、水），十年一轮，合起来六十年一个甲子。'] },
        { h: '生肖只是八个字中的一个', p: ['生肖是年柱的地支。完整的八字有八个字，真正代表你自己的是日柱，而不是年柱。所以同一个属相的人，性格和运势可以完全不同。'] },
      ],
    },
    es: {
      title: 'Horóscopo chino por año: ¿cuál es mi animal? (1930–2035) | FateCal',
      desc: 'Encuentra tu animal y elemento del horóscopo chino por año de nacimiento, con la fecha exacta del Año Nuevo chino de 1930 a 2035. ¿Naciste en enero o febrero? Revisa la fecha.',
      h1: 'Horóscopo chino por año: encuentra tu animal y elemento',
      lead: 'Tu animal del horóscopo chino depende de tu año de nacimiento, pero el año chino empieza con el Año Nuevo chino (finales de enero a mediados de febrero), no el 1 de enero. Si naciste antes de esa fecha, te corresponde el animal del año anterior.',
      sections: [
        { h: 'Los doce animales', p: ['Rata, Buey, Tigre, Conejo, Dragón, Serpiente, Caballo, Cabra, Mono, Gallo, Perro y Cerdo se repiten cada 12 años. Cada año tiene además un elemento (madera, fuego, tierra, metal o agua), que se repite cada 10 años: un ciclo de 60 años.'] },
        { h: 'Tu animal es solo uno de ocho caracteres', p: ['El animal es la rama de tu pilar del año. Tu carta BaZi completa tiene ocho caracteres, y el pilar del día, no el del año, te representa. Por eso dos personas del mismo animal pueden ser muy diferentes.'] },
      ],
    },
  },
};
