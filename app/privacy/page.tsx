import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy Policy · FateCal', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="November 19, 2026">
      <h2>The short version</h2>
      <p>FateCal does not have accounts yet. Your birth details, chart and events are stored in your own browser (local storage), not on our servers. We do not sell your personal information.</p>

      <h2>What we process</h2>
      <ul>
        <li><b>Birth details and events</b> you enter stay in your browser. Clearing your browser data, or using Settings → Reset, deletes them.</li>
        <li><b>Calendar links</b> (iCal/.ics) you connect are fetched by our server so your events can be read. We pass the events back to your browser and do not store the link or the events.</li>
        <li><b>Questions to FateBot</b> are sent from our server, together with the relevant parts of your reading (chart, day scores and upcoming events), to our AI provider, Anthropic, to write the answer. We do not keep a copy of your questions or answers.</li>
        <li><b>Technical logs</b>: our host, Vercel, keeps standard server logs (such as IP address, browser type and request time) for security and reliability.</li>
      </ul>

      <h2>Third parties</h2>
      <ul>
        <li><b>Vercel</b> hosts the site.</li>
        <li><b>Anthropic</b> processes FateBot questions as described above.</li>
        <li><b>Google Fonts</b> serves the site's fonts.</li>
        <li><b>Travelpayouts</b>: the site loads a script from this travel partner network, which may set cookies or similar identifiers to attribute bookings you make through travel links.</li>
      </ul>

      <h2>Affiliate links</h2>
      <p>Some links to travel and shopping sites are affiliate links. If you book or buy through them, we may earn a commission at no extra cost to you. Recommendations are based on your reading, not on commissions.</p>

      <h2>Children</h2>
      <p>FateCal is not directed to children under 13, and we do not knowingly collect their information.</p>

      <h2>Your choices</h2>
      <p>You can delete everything FateCal keeps about you on your device with Settings → Reset all data. California residents and others may contact us with any privacy request.</p>

      <h2>Contact</h2>
      <p>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

      <h2>Changes</h2>
      <p>We will post updates on this page and change the date above.</p>
    </LegalPage>
  );
}
