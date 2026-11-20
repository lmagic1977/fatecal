import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy Policy · FateCal', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="November 19, 2026">
      <h2>The short version</h2>
      <p>You can use FateCal without an account: your birth details, chart and events stay in your own browser (local storage). When sign-in is available and you use it, we keep them privately in your account so they follow you across devices. We do not sell your personal information.</p>

      <h2>What we process</h2>
      <ul>
        <li><b>Sign-in</b> (when offered): if you continue with Google or Facebook, we receive your name, email address and profile picture from them, and a user ID. If you use your email address or mobile number, we send a one-time code to it; for email we briefly keep a scrambled (hashed) copy of the code for up to 10 minutes. We use these only to identify your account and keep it secure.</li>
        <li><b>Account data</b>: when signed in, your birth details (and sex, if you chose it for feng shui directions), chart, manually added events, language, calendar link and forwarding-address key are stored privately on our host so you can use them on any device. Signing out or Settings → Reset all data removes the copy on your device; to delete your account data on our side, email us.</li>
        <li><b>Phone compass</b>: if you use the compass on the Feng Shui screen, the heading is read in your browser only to pick a direction and is never sent to us.</li>
        <li><b>Without an account</b>, birth details and events you enter stay in your browser. Clearing your browser data, or using Settings → Reset, deletes them.</li>
        <li><b>Calendar links</b> (iCal/.ics) you connect are fetched by our server so your events can be read. We pass the events back to your browser and do not store the events; the link itself is stored only if you are signed in.</li>
        <li><b>Questions to FateBot</b> are sent from our server, together with the relevant parts of your reading (chart, day scores and upcoming events), to our AI provider, Anthropic, to write the answer. We do not keep a copy of your questions or answers.</li>
        <li><b>Technical logs</b>: our host, Vercel, keeps standard server logs (such as IP address, browser type and request time) for security and reliability.</li>
      </ul>

      <h2>Third parties</h2>
      <ul>
        <li><b>Vercel</b> hosts the site and stores account data and forwarded-email extracts.</li>
        <li><b>Google</b> and <b>Meta (Facebook)</b> handle sign-in if you choose them.</li>
        <li><b>Postmark</b> sends your email sign-in codes, and receives emails you forward to your FateCal address and passes them to us; we keep only a short extract until your app collects it, plus a count of how many emails reached your address this month (to apply a monthly limit). Past the limit, new emails are not read or stored.</li>
        <li><b>Twilio</b> sends and checks SMS sign-in codes if you sign in with your mobile number; it receives your number for that purpose.</li>
        <li><b>Anthropic</b> processes FateBot questions as described above.</li>
        <li><b>Google Fonts</b> serves the site's fonts.</li>
        <li><b>Travelpayouts</b>: the site loads a script from this travel partner network, which may set cookies or similar identifiers to attribute bookings you make through travel links.</li>
      </ul>

      <h2>Affiliate links</h2>
      <p>Some links to travel and shopping sites are affiliate links. If you book or buy through them, we may earn a commission at no extra cost to you. The planning and reading tools are general suggestions, not personalized chart prescriptions. Our Amazon links use fixed search keywords and the affiliate ID fatecal-20; they do not include your birth details, chart or calendar events. Amazon may use cookies or other identifiers when you visit its site.</p>

      <p>As an Amazon Associate I earn from qualifying purchases. Read our <a href="/resources">affiliate disclosure and selection approach</a>.</p>

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
