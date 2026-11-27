import type { Metadata } from 'next';
import App from '@/components/App';
import { homeJsonLd, homeMetadata } from '@/lib/seo';

export const metadata: Metadata = homeMetadata('pt', '/');

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd('pt')) }} />
      <App initialLang="pt" pathLang="pt" />
    </>
  );
}
