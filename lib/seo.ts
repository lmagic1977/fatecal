import type { Metadata } from 'next';
import { T } from './i18n';
import { langPrefix, type L } from './goodDays';
import { PRICES } from './plans';

// hreflang + canonical for a path that exists in all three languages
export function alternates(lang: L, path: string): Metadata['alternates'] {
  const p = path === '/' ? '' : path;
  return {
    canonical: `${langPrefix(lang)}${p}` || '/',
    languages: { en: p || '/', 'zh-CN': `/zh${p}`, es: `/es${p}`, 'x-default': p || '/' },
  };
}

export const HOME_META: Record<L, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'FateCal: BaZi calendar that picks good days and hours for your plans',
    description: 'FateCal reads your BaZi (Four Pillars) chart and your schedule, scores every plan against the Chinese almanac, and suggests a better day or hour. Feng shui directions, flying stars and an AI advisor included.',
    keywords: ['BaZi calendar', 'Four Pillars of Destiny', 'Chinese almanac', 'auspicious dates', 'good days', 'Huangli', 'feng shui', 'date selection'],
  },
  zh: {
    title: '随身吉历 FateCal：按八字和老黄历给你的日程挑好日子、好时辰',
    description: '随身吉历按你的八字（四柱）和老黄历宜忌，给每个日程打分：哪天、几点签约、搬家、出行、见客户最顺，不顺就推荐更好的时间。还有风水方位、流年飞星、语音记日程和 AI 问答。',
    keywords: ['八字日历', '黄道吉日', '老黄历', '择日', '吉日查询', '风水', '流年飞星', '随身吉历'],
  },
  es: {
    title: 'FateCal: calendario BaZi que elige buenos días y horas para tus planes',
    description: 'FateCal lee tu carta BaZi (Cuatro Pilares) y tu agenda, puntúa cada plan según el almanaque chino y sugiere un mejor día u hora. Incluye direcciones de feng shui, estrellas voladoras y un asesor con IA.',
    keywords: ['calendario BaZi', 'Cuatro Pilares del Destino', 'almanaque chino', 'días propicios', 'feng shui'],
  },
};

export function homeMetadata(lang: L, path: string): Metadata {
  const m = HOME_META[lang];
  return {
    title: m.title, description: m.description, keywords: m.keywords, alternates: alternates(lang, path),
    openGraph: { title: m.title, description: m.description, url: `https://fatecal.com${langPrefix(lang) || '/'}`, siteName: lang === 'zh' ? '随身吉历 FateCal' : 'FateCal', type: 'website', locale: lang === 'zh' ? 'zh_CN' : lang === 'es' ? 'es_ES' : 'en_US' },
  };
}

// WebApplication + FAQPage structured data for the home page
export function homeJsonLd(lang: L) {
  const faq = T[lang].lp.faq as [string, string][];
  const usd = (c: number) => (c / 100).toFixed(2);
  return [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: 'FateCal', alternateName: '随身吉历', url: `https://fatecal.com${langPrefix(lang) || '/'}`,
      applicationCategory: 'LifestyleApplication', operatingSystem: 'Any (web browser)', inLanguage: lang === 'zh' ? 'zh-CN' : lang, description: HOME_META[lang].description,
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Basic (monthly)', price: usd(PRICES.basic.month.cents), priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Basic (yearly)', price: usd(PRICES.basic.year.cents), priceCurrency: 'USD' },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: lang === 'zh' ? 'zh-CN' : lang,
      mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
}
