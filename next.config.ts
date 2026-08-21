import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';
// Vercel preview deployments inject the vercel.live toolbar, which would only add CSP noise.
const isPreview = process.env.VERCEL_ENV === 'preview';

// Report-only CSP. Violations are spot-checked in DevTools (there is no report-to
// collector); switch the header name to `Content-Security-Policy` once a production
// session stays clean. 'unsafe-inline' for scripts is deliberate: Next.js hydration
// relies on inline scripts, and a nonce-based policy would have to be set per request
// in proxy.ts on every page (forcing static pages dynamic) — not worth it here.
const csp = [
  "default-src 'self'",
  // In development Next/React use eval for richer stack traces and @vercel/analytics
  // loads its debug script from va.vercel-scripts.com; neither happens in production.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // canvas-confetti renders in a blob: Web Worker
  "worker-src 'self' blob:",
  "connect-src 'self' https://api.web3forms.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(isPreview ? [] : [{ key: 'Content-Security-Policy-Report-Only', value: csp }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep `next dev` from appending its managed agent-rules block to the hand-written AGENTS.md.
  agentRules: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
