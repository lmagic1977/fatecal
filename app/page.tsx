import { headers } from 'next/headers';
import App from '@/components/App';

// First paint in the visitor's language (from the browser's Accept-Language), so there is no English flash.
function fromHeader(h: string | null): 'en' | 'zh' | 'es' {
  for (const part of (h ?? '').split(',')) {
    const p = part.trim().toLowerCase().slice(0, 2);
    if (p === 'zh') return 'zh';
    if (p === 'es') return 'es';
    if (p === 'en') return 'en';
  }
  return 'en';
}

export default async function Page() {
  return <App initialLang={fromHeader((await headers()).get('accept-language'))} />;
}
