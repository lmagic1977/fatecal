import type { Metadata } from 'next';
import App from '@/components/App';
import { homeJsonLd, homeMetadata } from '@/lib/seo';

export const metadata: Metadata = homeMetadata('es', '/');

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd('es')) }} />
      <App initialLang="es" pathLang="es" />
    </>
  );
}
