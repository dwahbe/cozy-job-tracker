import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'data policy — cozy job tracker',
  description:
    "How cozy job tracker handles your data. The short version: nothing weird happens with it.",
};

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
          <p className="text-base muted">Last updated: February 8, 2026</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">The short version</h2>
            <p className="muted">
              Your email is used to sign you in. That&apos;s it. I won&apos;t sell it, share it,
              or do anything weird with it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">What cozy job tracker collects</h2>
            <ul className="muted space-y-2 list-disc pl-5">
              <li>
                <strong>Email address</strong> — used solely for authentication (signing in via
                magic link). It&apos;s stored securely and never displayed publicly.
              </li>
              <li>
                <strong>Job board data</strong> — the jobs, columns, and notes you add to your
                board. This is your data, stored so you can access it when you come back.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              What cozy job tracker doesn&apos;t do
            </h2>
            <ul className="muted space-y-2 list-disc pl-5">
              <li>Sell or share your data with anyone</li>
              <li>
                Send you marketing emails (I don&apos;t even have a mailing list)
              </li>
              <li>
                Email you at all — unless you explicitly opt in, which I don&apos;t even ask for
                right now
              </li>
              <li>Track you with analytics or advertising pixels</li>
              <li>Use your data to train models or anything like that</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Cookies</h2>
            <p className="muted">
              cozy job tracker uses a session cookie to keep you signed in. No tracking cookies,
              no third-party cookies. Just the one that makes login work.
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
                className="underline underline-offset-2 decoration-dashed hover:decoration-solid"
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
              happy to explain anything.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
