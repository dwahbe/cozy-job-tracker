import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { UpstashRedisAdapter } from '@auth/upstash-redis-adapter';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function magicLinkHtml(url: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #fafaf8; font-family: Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafaf8;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 460px; background-color: #ffffff; border: 1px solid #f5e0c8; border-radius: 16px;">
          <tr>
            <td style="padding: 40px 36px 32px; text-align: center;">
              <p style="margin: 0 0 24px; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #1c1917;">
                cozy job tracker
              </p>
              <p style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1c1917;">
                Your magic link
              </p>
              <p style="margin: 0 0 28px; font-size: 15px; color: #78716c; line-height: 1.5;">
                Tap the button below to sign in — no password needed.
              </p>
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" bgcolor="#b45309" style="border-radius: 999px;">
                    <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 999px; background-color: #b45309;">
                      Sign in
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 36px 32px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #a8a29e; line-height: 1.5;">
                If you didn't request this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function magicLinkText(url: string) {
  return `Sign in to cozy job tracker\n\n${url}\n\nIf you didn't request this, you can safely ignore it.\n`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: UpstashRedisAdapter(redis),
  providers: [
    Resend({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      async sendVerificationRequest({ identifier: to, url, provider }) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: provider.from,
            to,
            subject: 'Your sign-in link — cozy job tracker',
            html: magicLinkHtml(url),
            text: magicLinkText(url),
          }),
        });
        if (!res.ok) {
          throw new Error('Resend error: ' + JSON.stringify(await res.json()));
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=1',
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.name = user.name;
      }
      return session;
    },
  },
});
