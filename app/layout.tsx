import type { Metadata, Viewport } from 'next';
import './globals.css';
import MetaPixel from '@/components/MetaPixel';

export const metadata: Metadata = {
  metadataBase: new URL('https://fatecal.com'),
  title: 'FateCal: Better timing. Better plans. Powered by BaZi',
  description: 'FateCal reads your BaZi chart and your schedule, and tells you when to do what.',
  openGraph: { title: 'FateCal', description: 'Your BaZi advisor that reads your schedule and tells you when to do what.', url: 'https://fatecal.com', siteName: 'FateCal', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'FateCal', description: 'Your BaZi advisor that reads your schedule.' },
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'FateCal', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#F6F4FD', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION ? (
          <meta name="facebook-domain-verification" content={process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION} />
        ) : null}
        <script
          async
          src="https://tp-em.com/NjAzNTUx.js?t=603551"
          data-cmp-ab="2"
        />
      </head>
      <body>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
