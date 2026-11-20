import type { MetadataRoute } from 'next';
import { SITE_URL, SHOPPING_ON } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/privacy', '/terms', ...(SHOPPING_ON ? ['/resources'] : [])].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'monthly', priority: p ? 0.3 : 1 }));
}
