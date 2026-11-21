import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GuidePage from '@/components/GuidePage';
import { GUIDES, GUIDE_SLUGS, type GuideSlug } from '@/lib/guides';
import { alternates } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() { return GUIDE_SLUGS.map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDES[slug as GuideSlug]?.zh;
  if (!g) return {};
  return { title: g.title, description: g.desc, alternates: alternates('zh', `/guides/${slug}`), openGraph: { title: g.title, description: g.desc, type: 'article' } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(GUIDE_SLUGS as readonly string[]).includes(slug)) notFound();
  return <GuidePage lang="zh" slug={slug as GuideSlug} />;
}
