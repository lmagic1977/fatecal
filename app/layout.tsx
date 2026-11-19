import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://fatecal.com'),
  title: 'FateCal: your BaZi advisor for real life',
  description: 'FateCal reads your BaZi chart and your schedule, and tells you when to do what.',
  openGraph: { title: 'FateCal', description: 'Your BaZi advisor that reads your schedule and tells you when to do what.', url: 'https://fatecal.com', siteName: 'FateCal', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'FateCal', description: 'Your BaZi advisor that reads your schedule.' },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'FateCal', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#F6F1E7', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://tp-em.com/NjAzNTUx.js?t=603551"
          data-cmp-ab="2"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
