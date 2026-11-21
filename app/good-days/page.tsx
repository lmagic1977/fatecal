import type { Metadata } from 'next';
import { GoodDaysHub, gdText } from '@/components/GoodDaysPage';
import { alternates } from '@/lib/seo';

export const metadata: Metadata = { title: `${gdText.en.hubH} | FateCal`, description: gdText.en.hubP, alternates: alternates('en', '/good-days') };
export const revalidate = 86400;

export default function Page() {
  return <GoodDaysHub lang="en" />;
}
