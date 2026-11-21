import type { MetadataRoute } from 'next';
import { SITE_URL, SHOPPING_ON } from '@/lib/site';
import { featuredMonths } from '@/lib/goodDays';

const LANGS = ['', '/zh', '/es'];
const alt = (p: string) => ({ languages: { en: `${SITE_URL}${p || '/'}`, 'zh-CN': `${SITE_URL}/zh${p}`, es: `${SITE_URL}/es${p}` } });

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];
  for (const l of LANGS) out.push({ url: `${SITE_URL}${l || '/'}`, changeFrequency: 'weekly', priority: 1, lastModified: now, alternates: alt('') });
  for (const l of LANGS) out.push({ url: `${SITE_URL}${l}/good-days`, changeFrequency: 'monthly', priority: 0.8, lastModified: now, alternates: alt('/good-days') });
  for (const ym of featuredMonths()) for (const l of LANGS) out.push({ url: `${SITE_URL}${l}/good-days/${ym}`, changeFrequency: 'monthly', priority: 0.7, alternates: alt(`/good-days/${ym}`) });
  for (const p of ['/privacy', '/terms', ...(SHOPPING_ON ? ['/resources'] : [])]) out.push({ url: `${SITE_URL}${p}`, changeFrequency: 'yearly', priority: 0.2 });
  return out;
}
