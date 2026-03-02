import Link from 'next/link';
import { listLegacyBoards } from '@/lib/kv';
import { LegacyBoardAccess } from '@/app/components/LegacyBoardAccess';
import { AnimatedCount } from '@/app/components/AnimatedCount';
import { HowItWorks } from '@/app/components/HowItWorks';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const legacyBoards = await listLegacyBoards();
  const boardCount = legacyBoards.length;

  return (
    <main className="page">
      {/* Hero */}
      <div className="container-app max-w-xl mb-2 sm:mb-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Track your job applications 🌱
        </h1>
        <p className="text-base sm:text-lg muted mb-8">
          A simple board for tracking the jobs you&apos;re applying to and the people helping you
          get there. Paste a job URL, it gets parsed, and added to your board with one click.
        </p>
        <div className="flex flex-col sm:flex-row items-start gap-3">
          <Link href="/login" className="btn btn-primary text-base px-6 py-2.5">
            Create your board
          </Link>
          <p className="text-sm muted sm:self-center">Free forever. No ads, no spam.</p>
        </div>
      </div>

      {/* How it works — visual 1-2-3 */}
      <div className="container-app max-w-3xl mb-2 sm:mb-4">
        <HowItWorks />
      </div>

      {/* Why this exists */}
      <div className="container-app max-w-xl mb-10 sm:mb-14 space-y-4">
        <p className="muted">
          That&apos;s basically it. No AI cover letter generators, no LinkedIn integrations, no
          &ldquo;career coaching.&rdquo; Just a clean board for keeping track of where you applied.
        </p>
        <p className="muted">
          I built this because job hunting is stressful enough without fighting your tracking tool.
          It&apos;s free, it&apos;s{' '}
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
              Currently helping <AnimatedCount value={boardCount} /> people track job apps!
            </>
          )}
        </p>
        <p className="muted mt-2">—Dylan</p>
      </div>

      {/* Legacy Board Migration -- TEMPORARY */}
      {boardCount > 0 && (
        <div className="container-app max-w-xl mb-4 sm:mb-6">
          <div className="card p-6 border-2 border-foreground/15">
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
        </div>
      )}
    </main>
  );
}
