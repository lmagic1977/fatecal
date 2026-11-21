import Footer from './Footer';
import { GUIDES, GUIDE_SLUGS, GOAT_2027, NEUTRAL_2027, animalName, elementName, zodiacYears, type GuideSlug } from '@/lib/guides';
import { langPrefix, featuredMonths, type L } from '@/lib/goodDays';

const UI = {
  en: { guides: 'Guides', cta: 'Get dates matched to your own chart, free', ctaH: 'Your chart, your calendar', ctaP: 'FateCal scores each plan in your calendar against your BaZi chart and the almanac, and suggests a better day or hour.', year: 'Year', animal: 'Animal', element: 'Element', starts: 'Chinese New Year', sign: 'Sign', note: 'What tradition says', more: 'More guides', goodDays: 'Good days by month', born: 'Born', also: 'Born in', },
  zh: { guides: '入门指南', cta: '免费查适合你八字的日子', ctaH: '你的八字，你的日程', ctaP: '随身吉历按你的八字和老黄历，给日程里的每件事打分，并推荐更好的日子和时辰。', year: '年份', animal: '生肖', element: '五行', starts: '春节日期', sign: '生肖', note: '传统说法', more: '更多指南', goodDays: '每月黄道吉日', born: '出生年份', also: '出生于' },
  es: { guides: 'Guías', cta: 'Ver fechas según mi carta, gratis', ctaH: 'Tu carta, tu calendario', ctaP: 'FateCal puntúa cada plan de tu calendario según tu carta BaZi y el almanaque, y sugiere un mejor día u hora.', year: 'Año', animal: 'Animal', element: 'Elemento', starts: 'Año Nuevo chino', sign: 'Signo', note: 'Lo que dice la tradición', more: 'Más guías', goodDays: 'Días propicios por mes', born: 'Nacidos en', also: 'Nacidos en' },
};

export default function GuidePage({ lang, slug }: { lang: L; slug: GuideSlug }) {
  const g = GUIDES[slug][lang], u = UI[lang], pre = langPrefix(lang);
  const years = zodiacYears();
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: g.h1, description: g.desc, inLanguage: lang === 'zh' ? 'zh-CN' : lang,
    author: { '@type': 'Organization', name: 'FateCal' }, publisher: { '@type': 'Organization', name: 'FateCal', logo: { '@type': 'ImageObject', url: 'https://fatecal.com/icon-512.png' } },
    mainEntityOfPage: `https://fatecal.com${pre}/guides/${slug}`, datePublished: '2026-11-21', dateModified: '2026-11-21',
  };
  return (
    <main className="gd" lang={lang === 'zh' ? 'zh-CN' : lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header className="gd-top"><a href={pre || '/'} className="gd-brand"><img src="/logo.svg" alt="FateCal" width={130} height={32} />{lang === 'zh' && <span className="zhname">随身吉历</span>}</a></header>
      <nav className="gd-langs" aria-label="Language">
        {(['en', 'zh', 'es'] as L[]).map((l) => <a key={l} href={`${langPrefix(l)}/guides/${slug}`} hrefLang={l === 'zh' ? 'zh-CN' : l} aria-current={l === lang ? 'page' : undefined}>{{ en: 'English', zh: '中文', es: 'Español' }[l]}</a>)}
      </nav>
      <article>
        <h1>{g.h1}</h1>
        <p className="gd-intro">{g.lead}</p>
        {g.sections.map((s, i) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((x) => <p key={x.slice(0, 20)}>{x}</p>)}
            {slug === 'year-of-the-fire-goat-2027' && i === 1 && (
              <div className="gd-tablewrap"><table className="gd-table">
                <thead><tr><th>{u.sign}</th><th>{u.also}</th><th>{u.note}</th></tr></thead>
                <tbody>{Array.from({ length: 12 }, (_, a) => {
                  const r = GOAT_2027[a];
                  const ys = years.filter((y) => y.a === a && y.y >= 1940 && y.y <= 2026).map((y) => y.y).slice(-6).join(', ');
                  return <tr key={a} className={r ? `tone-${r.tone}` : ''}><td><b>{animalName(a, lang)}</b></td><td>{ys}</td><td>{r ? r.tag[lang] : NEUTRAL_2027[lang]}</td></tr>;
                })}</tbody>
              </table></div>
            )}
            {slug === 'chinese-zodiac' && i === 0 && (
              <div className="gd-tablewrap"><table className="gd-table">
                <thead><tr><th>{u.year}</th><th>{u.animal}</th><th>{u.element}</th><th>{u.starts}</th></tr></thead>
                <tbody>{years.slice().reverse().map((y) => <tr key={y.y}><td><b>{y.y}</b></td><td>{animalName(y.a, lang)}</td><td>{elementName(y.e, lang)}</td><td>{y.start}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
        ))}
      </article>
      <aside className="gd-cta"><h2>{u.ctaH}</h2><p>{u.ctaP}</p><a className="primary btnlink" href={`${pre}/`}>{u.cta}</a></aside>
      <h2>{u.more}</h2>
      <ul className="gd-months">
        {GUIDE_SLUGS.filter((s) => s !== slug).map((s) => <li key={s}><a href={`${pre}/guides/${s}`}>{GUIDES[s][lang].h1}</a></li>)}
        <li><a href={`${pre}/good-days/${featuredMonths()[0]}`}>{u.goodDays}</a></li>
      </ul>
      <Footer lang={lang} />
    </main>
  );
}
