import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GoodDaysPage, { gdText, monthLabel } from '@/components/GoodDaysPage';
import { featuredMonths, ymOk } from '@/lib/goodDays';
import { alternates } from '@/lib/seo';

export const dynamicParams = true;
export const revalidate = 86400;
export function generateStaticParams() { return featuredMonths().map((ym) => ({ ym })); }

export async function generateMetadata({ params }: { params: Promise<{ ym: string }> }): Promise<Metadata> {
  const { ym } = await params;
  if (!ymOk(ym)) return {};
  const { y, m } = monthLabel(ym, 'es');
  return { title: gdText.es.title(m, y), description: gdText.es.desc(m, y), alternates: alternates('es', `/good-days/${ym}`) };
}

export default async function Page({ params }: { params: Promise<{ ym: string }> }) {
  const { ym } = await params;
  if (!ymOk(ym)) notFound();
  return <GoodDaysPage lang="es" ym={ym} />;
}
