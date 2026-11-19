import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';

// Sign in with Google or Meta (Facebook). Sessions are signed cookies (JWT); no database adapter.
// Env: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_FACEBOOK_ID, AUTH_FACEBOOK_SECRET
export const providerIds = [
  ...(process.env.AUTH_GOOGLE_ID ? ['google'] : []),
  ...(process.env.AUTH_FACEBOOK_ID ? ['facebook'] : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    ...(process.env.AUTH_FACEBOOK_ID ? [Facebook] : []),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // a stable account id: provider + the provider's user id
    jwt({ token, account }) {
      if (account) token.uid = `${account.provider}:${account.providerAccountId}`;
      return token;
    },
    session({ session, token }) {
      (session as any).uid = token.uid;
      return session;
    },
  },
  pages: { signIn: '/' },
});
