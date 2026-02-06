import type { Metadata } from 'next';
import Link from 'next/link';
import { changelog } from '../changelog-data';
import { ChangelogFeedbackCTA } from './ChangelogFeedbackCTA';

export const metadata: Metadata = {
  title: "what's new — cozy job tracker",
  description: 'The latest updates and improvements to Cozy Job Tracker.',
};

const tagLabels: Record<string, string> = {
  new: 'new',
  improvement: 'improvement',
  fix: 'fix',
};

export default function ChangelogPage() {
  return (
    <main className="page">
      <div className="container-app max-w-2xl">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm muted hover:underline inline-flex items-center gap-1 mb-4"
          >
            ← back home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">what&apos;s new</h1>
          <p className="text-base muted">the latest updates to cozy job tracker.</p>
        </div>

        {/* Entries */}
        <div className="changelog-list">
          {changelog.map((entry, i) => (
            <article key={i} className="changelog-row">
              <div className="changelog-date-col">
                <time className="changelog-date">{entry.date}</time>
              </div>
              <div className="changelog-content-col">
                {entry.tag && (
                  <span className={`changelog-tag changelog-tag-${entry.tag}`}>
                    {tagLabels[entry.tag]}
                  </span>
                )}
                <h2 className="changelog-entry-title">
                  <span className="changelog-emoji">{entry.emoji}</span>
                  {entry.title}
                </h2>
                <p className="changelog-entry-desc">{entry.description}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Feedback CTA */}
        <ChangelogFeedbackCTA />
      </div>
    </main>
  );
}
