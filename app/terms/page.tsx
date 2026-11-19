import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of Service · FateCal', alternates: { canonical: '/terms' } };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="November 19, 2026">
      <p>By using FateCal you agree to these terms.</p>

      <h2>What FateCal is</h2>
      <p>FateCal offers readings based on BaZi (Four Pillars) and the traditional Chinese almanac, for reflection, cultural interest and entertainment. Readings follow a simplified, rule-based model and FateBot uses AI to explain them; both can be wrong or incomplete.</p>

      <h2>Not professional advice</h2>
      <p>Nothing in FateCal is medical, legal, financial, tax or other professional advice. Do not delay or skip medical care, legal advice or financial due diligence because of a reading. You are responsible for your own decisions.</p>

      <h2>Your use</h2>
      <ul>
        <li>Use FateCal lawfully and do not try to disrupt or overload the service, or to use it to access other systems.</li>
        <li>Only connect calendars and enter information you have the right to use.</li>
      </ul>

      <h2>Links and affiliate partners</h2>
      <p>FateCal may link to other sites, including affiliate partners. We are not responsible for their content, products, prices or policies, and purchases you make there are between you and them.</p>

      <h2>No warranty</h2>
      <p>FateCal is provided "as is" and "as available", without warranties of any kind, to the fullest extent the law allows.</p>

      <h2>Limitation of liability</h2>
      <p>To the fullest extent the law allows, FateCal and its operators are not liable for indirect, incidental or consequential damages, or for any loss arising from decisions made using the service.</p>

      <h2>Changes</h2>
      <p>We may update the service and these terms. Continued use after changes means you accept them.</p>

      <h2>Contact</h2>
      <p>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
