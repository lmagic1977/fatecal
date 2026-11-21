import Footer from './Footer';
import { GD_ACTS, MONTH_NAMES, featuredMonths, gloss, langPrefix, monthDays, shiftYm, wdName, type L } from '@/lib/goodDays';

// Public, static pages: general good days from the traditional almanac for one month,
// in English, Chinese or Spanish. They end with a pointer to personal dates in FateCal.
const S = {
  en: {
    h1: (m: string, y: number) => `Good days in ${m} ${y}: Chinese almanac dates for weddings, moving, opening and signing`,
    title: (m: string, y: number) => `Good Days ${m} ${y}: Weddings, Moving, Opening, Signing | FateCal`,
    desc: (m: string, y: number) => `Auspicious days in ${m} ${y} from the traditional Chinese almanac (Huangli): the best dates for weddings, moving house, opening a business, signing contracts, travel and renovation.`,
    intro: 'These dates come from the traditional Chinese almanac (黄历, Huangli), which lists what each day suits (宜) and should avoid (忌). They are the same for everyone. Your own best days also depend on your BaZi birth chart: a generally good day can clash with your chart.',
    byAct: 'Best days by activity', none: 'No clearly good day this month.', all: 'Day by day', date: 'Date', lunar: 'Lunar date', gz: 'Day pillar', yi: 'Suits', ji: 'Avoid', clash: 'Clashes with',
    ctaH: 'Find the days that suit you', ctaP: 'FateCal reads your BaZi chart and your calendar, scores each plan, and suggests a better day or hour when one doesn\'t suit you.', cta: 'Get my personal dates, free',
    prev: 'Previous month', next: 'Next month', more: 'Other months', hubH: 'Good days by month', hubP: 'Monthly lists of auspicious dates from the traditional Chinese almanac.',
    note: 'Traditional culture, not science. Use it as one consideration, after real-world facts and professional advice.', home: 'FateCal home',
  },
  zh: {
    h1: (m: string, y: number) => `${y}年${m}黄道吉日：结婚、搬家、开业、签约吉日一览`,
    title: (m: string, y: number) => `${y}年${m}黄道吉日查询：结婚、搬家、开业、签约 | 随身吉历`,
    desc: (m: string, y: number) => `${y}年${m}黄道吉日大全：按老黄历宜忌整理的结婚嫁娶、搬家入宅、开业开市、签约交易、出行、装修动土吉日，附每日宜忌、干支和冲煞。`,
    intro: '以下日期按老黄历整理，列出每天「宜」做什么、「忌」做什么，对所有人都一样。但每个人的好日子还要看自己的八字：黄历上的好日子，也可能和你的八字相冲。',
    byAct: '按事情查吉日', none: '本月没有特别合适的日子。', all: '每日宜忌', date: '日期', lunar: '农历', gz: '日柱', yi: '宜', ji: '忌', clash: '冲',
    ctaH: '查适合你自己的好日子', ctaP: '随身吉历会结合你的八字和日程，给每件事打分；时间不合适时，推荐更好的日子和时辰。', cta: '免费查我的专属吉日',
    prev: '上个月', next: '下个月', more: '其他月份', hubH: '每月黄道吉日', hubP: '按老黄历整理的每月吉日，结婚、搬家、开业、签约都能查。',
    note: '传统文化参考，不是科学，请优先考虑实际情况和专业意见。', home: '随身吉历首页',
  },
  es: {
    h1: (m: string, y: number) => `Días propicios de ${m} de ${y} según el almanaque chino: bodas, mudanzas, aperturas y firmas`,
    title: (m: string, y: number) => `Días propicios ${m} ${y}: bodas, mudanzas, firmas | FateCal`,
    desc: (m: string, y: number) => `Los días más propicios de ${m} de ${y} según el almanaque chino tradicional (Huangli): las mejores fechas para bodas, mudanzas, abrir un negocio, firmar contratos, viajar y hacer obras.`,
    intro: 'Estas fechas vienen del almanaque chino tradicional (黄历, Huangli), que indica para qué es bueno cada día (宜) y qué conviene evitar (忌). Son iguales para todos. Tus mejores días también dependen de tu carta BaZi: un día generalmente bueno puede chocar con tu carta.',
    byAct: 'Mejores días por actividad', none: 'No hay un día claramente bueno este mes.', all: 'Día a día', date: 'Fecha', lunar: 'Fecha lunar', gz: 'Pilar del día', yi: 'Bueno para', ji: 'Evitar', clash: 'Choca con',
    ctaH: 'Encuentra los días que te convienen', ctaP: 'FateCal lee tu carta BaZi y tu calendario, puntúa cada plan y sugiere un mejor día u hora cuando no te conviene.', cta: 'Ver mis fechas personales gratis',
    prev: 'Mes anterior', next: 'Mes siguiente', more: 'Otros meses', hubH: 'Días propicios por mes', hubP: 'Listas mensuales de fechas propicias según el almanaque chino tradicional.',
    note: 'Cultura tradicional, no ciencia. Úsalo como un dato más, después de los hechos y el consejo profesional.', home: 'Inicio de FateCal',
  },
};
export const gdText = S;
export function monthLabel(ym: string, lang: L) { const [y, m] = ym.split('-').map(Number); return { y, m: MONTH_NAMES[lang][m - 1] }; }

const ACT = (a: (typeof GD_ACTS)[number], lang: L) => a[lang];
const dayLabel = (y: number, m: number, d: number, wd: number, lang: L) =>
  lang === 'zh' ? `${m}月${d}日 ${wdName(wd, lang)}` : lang === 'es' ? `${wdName(wd, lang)} ${d}/${m}` : `${wdName(wd, lang)}, ${MONTH_NAMES.en[m - 1].slice(0, 3)} ${d}`;

function LangLinks({ lang, path }: { lang: L; path: string }) {
  return (
    <nav className="gd-langs" aria-label="Language">
      {(['en', 'zh', 'es'] as L[]).map((l) => <a key={l} href={`${langPrefix(l)}${path}`} aria-current={l === lang ? 'page' : undefined} hrefLang={l === 'zh' ? 'zh-CN' : l}>{{ en: 'English', zh: '中文', es: 'Español' }[l]}</a>)}
    </nav>
  );
}
function Head({ lang }: { lang: L }) {
  return (
    <header className="gd-top">
      <a href={langPrefix(lang) || '/'} className="gd-brand"><img src="/logo.svg" alt="FateCal" width={115} height={28} />{lang === 'zh' && <span className="zhname">随身吉历</span>}</a>
    </header>
  );
}

export default function GoodDaysPage({ lang, ym }: { lang: L; ym: string }) {
  const t = S[lang];
  const [y, m] = ym.split('-').map(Number);
  const days = monthDays(y, m);
  const { m: mName } = monthLabel(ym, lang);
  const home = `${langPrefix(lang) || ''}/`;
  const prev = shiftYm(ym, -1), next = shiftYm(ym, 1);
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'FateCal', item: `https://fatecal.com${langPrefix(lang) || '/'}` },
      { '@type': 'ListItem', position: 2, name: t.hubH, item: `https://fatecal.com${langPrefix(lang)}/good-days` },
      { '@type': 'ListItem', position: 3, name: t.h1(mName, y), item: `https://fatecal.com${langPrefix(lang)}/good-days/${ym}` },
    ],
  };
  return (
    <main className="gd" lang={lang === 'zh' ? 'zh-CN' : lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Head lang={lang} />
      <LangLinks lang={lang} path={`/good-days/${ym}`} />
      <h1>{t.h1(mName, y)}</h1>
      <p className="gd-intro">{t.intro}</p>

      <h2>{t.byAct}</h2>
      <div className="gd-acts">
        {GD_ACTS.map((a) => {
          const hits = days.filter((d) => d.good.includes(a.key));
          return (
            <section key={a.key} className="gd-act">
              <h3>{a.emoji} {ACT(a, lang)}</h3>
              {hits.length ? <p>{hits.map((d) => dayLabel(y, m, d.d, d.wd, lang)).join(lang === 'zh' ? '、' : ' · ')}</p> : <p className="muted">{t.none}</p>}
            </section>
          );
        })}
      </div>

      <aside className="gd-cta">
        <h2>{t.ctaH}</h2>
        <p>{t.ctaP}</p>
        <a className="primary btnlink" href={home}>{t.cta}</a>
      </aside>

      <h2>{t.all}</h2>
      <div className="gd-tablewrap">
        <table className="gd-table">
          <thead><tr><th>{t.date}</th><th>{t.lunar} · {t.gz}</th><th>{t.yi}</th><th>{t.ji}</th></tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.d}>
                <td><b>{dayLabel(y, m, d.d, d.wd, lang)}</b></td>
                <td>{d.lunar} · {d.ganzhi}<br /><span className="muted">{t.clash} {d.clash}</span></td>
                <td>{d.yi.slice(0, 6).map((w) => gloss(w, lang)).join(lang === 'zh' ? ' ' : ', ')}</td>
                <td>{d.ji.slice(0, 5).map((w) => gloss(w, lang)).join(lang === 'zh' ? ' ' : ', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="gd-nav">
        <a href={`${langPrefix(lang)}/good-days/${prev}`} rel="prev">← {t.prev}</a>
        <a href={`${langPrefix(lang)}/good-days`}>{t.more}</a>
        <a href={`${langPrefix(lang)}/good-days/${next}`} rel="next">{t.next} →</a>
      </nav>
      <p className="tiny">{t.note}</p>
      <Footer lang={lang} />
    </main>
  );
}

export function GoodDaysHub({ lang }: { lang: L }) {
  const t = S[lang];
  return (
    <main className="gd" lang={lang === 'zh' ? 'zh-CN' : lang}>
      <Head lang={lang} />
      <LangLinks lang={lang} path="/good-days" />
      <h1>{t.hubH}</h1>
      <p className="gd-intro">{t.hubP} {t.intro}</p>
      <ul className="gd-months">
        {featuredMonths().map((ym) => { const { y, m } = monthLabel(ym, lang); return <li key={ym}><a href={`${langPrefix(lang)}/good-days/${ym}`}>{lang === 'zh' ? `${y}年${m}黄道吉日` : lang === 'es' ? `Días propicios de ${m} ${y}` : `Good days in ${m} ${y}`}</a></li>; })}
      </ul>
      <aside className="gd-cta"><h2>{t.ctaH}</h2><p>{t.ctaP}</p><a className="primary btnlink" href={`${langPrefix(lang) || ''}/`}>{t.cta}</a></aside>
      <Footer lang={lang} />
    </main>
  );
}
