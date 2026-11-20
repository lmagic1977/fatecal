import type { Metadata } from 'next';
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

export async function generateMetadata(): Promise<Metadata> {
  const l = fromHeader((await headers()).get('accept-language'));
  if (l === 'zh') return { title: '随身命历 FateCal：给重要的事，挑个好时间', description: '随身命历按你的八字和老黄历看你的日程：哪天、几点做什么事最顺，不顺的换哪个时间。' };
  if (l === 'es') return { title: 'FateCal: tu asesor BaZi para la vida real', description: 'FateCal lee tu agenda según tu carta BaZi y el almanaque tradicional y te dice cuándo hacer cada cosa.' };
  return {};
}

export default async function Page() {
  return <App initialLang={fromHeader((await headers()).get('accept-language'))} />;
}
