import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/guard';
import { adminEmails, stats } from '@/lib/accounts';
import { renderReport } from '@/lib/report';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'FateCal admin', robots: { index: false, follow: false } };

// Operator dashboard: the same numbers as the daily email, live. Only FATECAL_ADMINS emails can see it.
export default async function Admin() {
  const u = await currentUser();
  if (!u?.email || !adminEmails().includes(u.email.toLowerCase())) notFound();
  const r = renderReport(await stats());
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
      <pre style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.text}</pre>
    </main>
  );
}
