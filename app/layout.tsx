import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FateCal: your BaZi advisor for real life',
  description: 'FateCal reads your BaZi chart and your schedule, and tells you when to do what.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'FateCal', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#F6F1E7', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
