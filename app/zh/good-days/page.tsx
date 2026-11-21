import type { Metadata } from 'next';
import { GoodDaysHub, gdText } from '@/components/GoodDaysPage';
import { alternates } from '@/lib/seo';

export const metadata: Metadata = { title: `${gdText.zh.hubH} | 随身吉历`, description: gdText.zh.hubP, alternates: alternates('zh', '/good-days') };
export const revalidate = 86400;

export default function Page() {
  return <GoodDaysHub lang="zh" />;
}
