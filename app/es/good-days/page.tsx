import type { Metadata } from 'next';
import { GoodDaysHub, gdText } from '@/components/GoodDaysPage';
import { alternates } from '@/lib/seo';

export const metadata: Metadata = { title: `${gdText.es.hubH} | FateCal`, description: gdText.es.hubP, alternates: alternates('es', '/good-days') };
export const revalidate = 86400;

export default function Page() {
  return <GoodDaysHub lang="es" />;
}
