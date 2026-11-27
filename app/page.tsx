import type { Metadata } from 'next';
import { headers } from 'next/headers';
import App from '@/components/App';
import { homeJsonLd, homeMetadata } from '@/lib/seo';

// First paint in the visitor's language (from the browser's Accept-Language), so there is no English flash.
function fromHeader(h: string | null): 'en' | 'zh' | 'es' | 'pt' {
  for (const part of (h ?? '').split(',')) {
    const p = part.trim().toLowerCase().slice(0, 2);
    if (p === 'zh') return 'zh';
    if (p === 'es') return 'es';
    if (p === 'pt') return 'pt';
    if (p === 'en') return 'en';
  }
  return 'en';
}

// "/" is the English page for search engines (hreflang points Chinese and Spanish to /zh and /es);
// visitors still get their own language.
export const metadata: Metadata = homeMetadata('en', '/');

export default async function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd('en')) }} />
      <App initialLang={fromHeader((await headers()).get('accept-language'))} />
    </>
  );
}
