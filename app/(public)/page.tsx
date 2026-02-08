import Link from 'next/link';
import { listLegacyBoards } from '@/lib/kv';
import { LegacyBoardAccess } from '@/app/components/LegacyBoardAccess';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const legacyBoards = await listLegacyBoards();
  const boardCount = legacyBoards.length;

  return (
    <main className="page">
      <div className="container-app max-w-xl">
        {/* Hero */}
        <div className="mb-12 sm:mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Track your job hunt, stress-free 🌱
          </h1>
          <p className="text-base sm:text-lg muted mb-8">
            A simple board for tracking where you&apos;ve applied. Paste a URL, get a job card.
          </p>
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Link href="/login" className="btn btn-primary text-base px-6 py-2.5">
              Start tracking
            </Link>
            <p className="text-sm muted sm:self-center">No password needed — just your email</p>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-12 sm:mb-16 space-y-4">
          <h2 className="text-lg font-semibold">Here&apos;s how it works</h2>
          <p className="muted">
            Paste a job posting URL and it pulls the title, company, location, type — all of it. Add
            your own columns, track statuses & due dates, and jot down notes. If you&apos;re sitting
            on a pile of bookmarks, paste up to 50 URLs at once.
          </p>
          <p className="muted">
            That&apos;s basically it. No AI cover letter generators, no LinkedIn integrations, no
            &ldquo;career coaching.&rdquo; Just a clean board for keeping track of where you
            applied.
          </p>
        </div>

        {/* Legacy Board Migration -- TEMPORARY */}
        {boardCount > 0 && (
          <div className="card p-6 mb-12 sm:mb-16 border-2 border-foreground/15">
            <h2 className="text-xl font-semibold mb-2">Already have a board?</h2>
            <p className="muted mb-5">
              cozy job tracker now has email accounts — your board is safe and waiting. Sign in to
              claim it and keep your data secure, or access it directly below.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <Link href="/login" className="btn btn-primary text-sm text-center">
                Sign in &amp; import your board
              </Link>
            </div>
            <div>
              <p className="text-sm muted mb-2">Or go to your board directly:</p>
              <LegacyBoardAccess />
            </div>
          </div>
        )}

        {/* Why this exists */}
        <div>
          <p className="muted">
            I built this because job hunting is stressful enough without fighting your tracking
            tool. It&apos;s free, it&apos;s{' '}
            <a
              href="https://github.com/dwahbe/cozy-job-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-dashed hover:decoration-solid"
            >
              open source
            </a>
            , and I use it myself.
            {boardCount > 0 && (
              <>
                {' '}
                Currently it&apos;s me and {boardCount} other{boardCount === 1 ? '' : 's'}. Come
                join us!
              </>
            )}
          </p>
          <p className="muted mt-2">—Dylan</p>
        </div>
      </div>
    </main>
  );
}
