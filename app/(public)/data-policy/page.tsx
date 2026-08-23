import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'data policy — cozy job tracker',
  description:
    'How cozy job tracker handles your data. The short version: nothing weird happens with it.',
  openGraph: {
    title: 'data policy — cozy job tracker',
    description:
      'How cozy job tracker handles your data. The short version: nothing weird happens with it.',
    images: [{ url: '/api/og/data-policy', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'data policy — cozy job tracker',
    description:
      'How cozy job tracker handles your data. The short version: nothing weird happens with it.',
    images: ['/api/og/data-policy'],
  },
};

const externalLink = 'underline underline-offset-2 decoration-dashed hover:decoration-solid';

export default function DataPolicyPage() {
  return (
    <main className="page">
      <div className="container-app max-w-2xl">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm muted hover:underline inline-flex items-center gap-1 mb-4"
          >
            ← Back home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Data policy</h1>
          <p className="text-base muted">Last updated: August 22, 2026</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">The short version</h2>
            <p className="muted">
              Your email signs you in, your board and network are yours, and the only other services
              that ever see any of it are the ones that make a feature work (listed below). I
              don&apos;t sell it, share it, or do anything weird with it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">What cozy job tracker stores</h2>
            <ul className="muted space-y-2 list-disc pl-5">
              <li>
                <strong>Email address</strong> — used to sign you in via magic link and to show who
                you&apos;re signed in as. Never displayed publicly.
              </li>
              <li>
                <strong>Job board data</strong> — the jobs, columns, notes, and due dates you add.
                Deleted jobs sit in your trash for 30 days, then they&apos;re gone for good.
              </li>
              <li>
                <strong>Network data</strong> — the people you choose to track (names, companies,
                titles, LinkedIn links, your notes about them). This is information about other
                people, so please only add what you&apos;d be comfortable with them seeing.
              </li>
              <li>
                <strong>Feedback</strong> — if you use the feedback button, the message you type is
                sent to my inbox. It&apos;s not tied to your account unless you include your name.
              </li>
            </ul>
            <p className="muted mt-3">
              Everything is stored in a Redis database hosted by Upstash and served from Vercel.
              There&apos;s no public board view — only you (signed in) can see your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Services that help run it</h2>
            <ul className="muted space-y-2 list-disc pl-5">
              <li>
                <strong>OpenAI</strong> — when you paste a job URL (on the site, in the Chrome
                extension, or through an AI assistant), the page is fetched and its text is sent to
                OpenAI&apos;s API to pull out the title, company, location, and details. Only that
                page&apos;s content is sent — never your board, your email, or your network.
              </li>
              <li>
                <strong>Vercel Analytics</strong> — anonymous, cookieless page-view counts so I can
                see which parts of the site get used. No cross-site tracking, no advertising pixels,
                and nothing that identifies you.
              </li>
              <li>
                <strong>Resend</strong> — sends the magic-link sign-in email.
              </li>
              <li>
                <strong>Web3Forms</strong> — delivers feedback messages to my inbox.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">AI assistants (MCP)</h2>
            <p className="muted">
              You can connect an AI assistant like Claude to your board from{' '}
              <Link href="/settings" className={externalLink}>
                settings
              </Link>
              . You choose what it&apos;s allowed to do when you approve the connection (read-only,
              or read and write), and you can revoke it at any time. The assistant only ever acts on
              your own board and network, and only while that connection is active.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">What cozy job tracker doesn&apos;t do</h2>
            <ul className="muted space-y-2 list-disc pl-5">
              <li>Sell or share your data with anyone</li>
              <li>Send you marketing emails (I don&apos;t even have a mailing list)</li>
              <li>Email you at all, other than the sign-in link you asked for</li>
              <li>Use advertising pixels or track you across other sites</li>
              <li>Train AI models on your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Cookies</h2>
            <p className="muted">
              cozy job tracker uses a session cookie to keep you signed in. No tracking cookies, no
              third-party cookies. Just the one that makes login work.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Chrome extension</h2>
            <p className="muted mb-3">
              The cozy job tracker Chrome extension lets you save job postings to your board with
              one click. Here&apos;s what it accesses:
            </p>
            <ul className="muted space-y-2 list-disc pl-5">
              <li>
                <strong>Session cookie</strong> — the extension reads your existing
                cozyjobtracker.com session cookie to verify you&apos;re signed in. It doesn&apos;t
                create or modify any cookies.
              </li>
              <li>
                <strong>Current page URL</strong> — when you click &quot;Add to board&quot;, the URL
                of the page you&apos;re on is sent to cozyjobtracker.com to parse the job posting
                (see OpenAI above). No other browsing data is collected.
              </li>
              <li>
                <strong>Local cache</strong> — your email is cached in the browser so the popup
                loads faster. This cache is automatically cleared when you close the browser.
              </li>
            </ul>
            <p className="muted mt-3">
              The extension doesn&apos;t track your browsing, run on pages in the background, or
              collect any data beyond what&apos;s described above.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Open source</h2>
            <p className="muted">
              This project is{' '}
              <a
                href="https://github.com/dwahbe/cozy-job-tracker"
                target="_blank"
                rel="noopener noreferrer"
                className={externalLink}
              >
                open source
              </a>
              . You can see exactly what the code does.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Questions?</h2>
            <p className="muted">
              If anything here is unclear, reach out — I&apos;m just one person building this and
              happy to explain anything. Want your account and data deleted? Send me a note through
              the feedback button and I&apos;ll take care of it.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
