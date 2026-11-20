import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import Credentials from 'next-auth/providers/credentials';
import { emailEnabled, phoneEnabled, normEmail, normPhone, checkEmailCode, checkPhoneCode } from '@/lib/otp';

// Sign in with Google, Meta (Facebook), or a one-time code sent by email or SMS.
// Sessions are signed cookies (JWT); no database adapter.
// Env: AUTH_SECRET, AUTH_GOOGLE_ID/SECRET, AUTH_FACEBOOK_ID/SECRET, POSTMARK_SERVER_TOKEN, TWILIO_* (see lib/otp.ts)
export const providerIds = [
  ...(process.env.AUTH_GOOGLE_ID ? ['google'] : []),
  ...(process.env.AUTH_FACEBOOK_ID ? ['facebook'] : []),
  ...(emailEnabled() ? ['email'] : []),
  ...(phoneEnabled() ? ['phone'] : []),
];

const maskPhone = (p: string) => `${p.slice(0, p.length - 8)}****${p.slice(-4)}`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    ...(process.env.AUTH_FACEBOOK_ID ? [Facebook] : []),
    Credentials({
      id: 'otp',
      name: 'Code',
      credentials: { channel: {}, to: {}, code: {} },
      async authorize(c) {
        const code = String(c?.code ?? '');
        if (!/^\d{4,8}$/.test(code)) return null;
        if (c?.channel === 'email' && emailEnabled()) {
          const e = normEmail(String(c.to ?? ''));
          return e && (await checkEmailCode(e, code)) ? { id: `email:${e}`, email: e, name: e } : null;
        }
        if (c?.channel === 'phone' && phoneEnabled()) {
          const p = normPhone(String(c.to ?? ''));
          return p && (await checkPhoneCode(p, code)) ? { id: `phone:${p}`, name: maskPhone(p) } : null;
        }
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // A stable account id. Verified emails share one account whether you use Google or an email code;
    // `alt` keeps the older provider-based id so data saved under it is still found.
    async jwt({ token, account, user, profile }) {
      if (account?.provider === 'otp' && user?.id) token.uid = user.id;
      else if (account) {
        token.alt = `${account.provider}:${account.providerAccountId}`;
        const email = (profile as any)?.email;
        token.uid = account.provider === 'google' && email && (profile as any)?.email_verified ? `email:${String(email).toLowerCase()}` : token.alt;
      }
      // account is only present at sign-in: note the sign-up / visit for the operator's daily report
      if (account && token.uid) {
        const provider = account.provider === 'otp' ? (String(token.uid).startsWith('phone:') ? 'phone' : 'email') : account.provider;
        await import('@/lib/accounts').then((m) => m.recordSignIn(String(token.uid), provider, user?.email, user?.name)).catch(() => {});
      }
      return token;
    },
    session({ session, token }) {
      (session as any).uid = token.uid;
      (session as any).alt = token.alt;
      return session;
    },
  },
  pages: { signIn: '/' },
});
