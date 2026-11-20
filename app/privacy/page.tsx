import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL, SHOPPING_ON } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy Policy · FateCal', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="November 19, 2026">
      <h2>The short version</h2>
      <p>Anyone can look at the FateCal home page and demo without an account. To use FateCal itself you sign in with Google, your email address or your mobile number; your birth details, chart and events are then kept privately in your account so they follow you across devices, with a copy in your browser. We do not sell your personal information.</p>

      <h2>What we process</h2>
      <ul>
        <li><b>Sign-in</b>: if you continue with Google or Facebook, we receive your name, email address and profile picture from them, and a user ID. If you use your email address or mobile number, we send a one-time code to it; for email we briefly keep a scrambled (hashed) copy of the code for up to 10 minutes. We use these only to identify your account and keep it secure.</li>
        <li><b>Account data</b>: when signed in, your birth details (and sex, if you chose it for feng shui directions), chart, manually added events, language, calendar link and forwarding-address key are stored privately on our host so you can use them on any device. Signing out or Settings → Reset all data removes the copy on your device; to delete your account data on our side, email us.</li>
        <li><b>Phone compass</b>: if you use the compass on the Feng Shui screen, the heading is read in your browser only to pick a direction and is never sent to us.</li>
        <li><b>Google Calendar</b> (if you connect it): with read-only permission, FateCal reads the titles and times of events on your visible calendars from 2 days ago to 60 days ahead, to score them against your chart. We never change, create or delete events. Google gives us a refresh token, which we store encrypted and link only to a random key kept in your browser; event details are sent to your browser and not kept on our servers. When you ask FateBot a question, upcoming event titles and times may be included in what is sent to our AI provider, only to answer that question. Disconnecting in Settings deletes the token and revokes access (you can also remove FateCal at myaccount.google.com/permissions). FateCal&apos;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements: we do not use it for advertising, do not sell it, and do not use it to train AI models.</li>
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
        <li><b>Stripe</b> processes subscription payments. Your card details go to Stripe directly and never reach our servers; we keep only your plan, its status and Stripe's customer reference.</li>
        <li><b>Anthropic</b> processes FateBot questions as described above.</li>
        <li><b>Google Fonts</b> serves the site's fonts.</li>
        <li><b>Travelpayouts</b>: the site loads a script from this travel partner network, which may set cookies or similar identifiers to attribute bookings you make through travel links.</li>
      </ul>

      <h2>Affiliate links</h2>
      <p>Some links to travel and shopping sites are affiliate links. If you book or buy through them, we may earn a commission at no extra cost to you. The planning and reading tools are general suggestions, not personalized chart prescriptions. Our Amazon links use fixed search keywords and the affiliate ID fatecal-20; they do not include your birth details, chart or calendar events. Amazon may use cookies or other identifiers when you visit its site.</p>

      {SHOPPING_ON && <p>As an Amazon Associate I earn from qualifying purchases. Read our <a href="/resources">affiliate disclosure and selection approach</a>.</p>}

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
