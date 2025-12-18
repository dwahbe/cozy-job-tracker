import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getBoard, getColumnOrder } from '@/lib/kv';
import { JobForm } from '@/app/components/JobForm';
import { JobsView } from '@/app/components/JobsView';
import { ColumnManager } from '@/app/components/ColumnManager';
import { PinForm } from '@/app/components/PinForm';
import { PinSettings } from '@/app/components/PinSettings';
import type { ParsedJob } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const SLUG_REGEX = /^[a-z0-9-]+$/;

export default async function BoardPage({ params }: PageProps) {
  const { slug } = await params;

  // Validate slug
  if (!SLUG_REGEX.test(slug)) {
    notFound();
  }

  // Get board from KV
  const board = await getBoard(slug);

  if (!board) {
    notFound();
  }

  // Check PIN protection
  if (board.pin) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(`board_${slug}_auth`);

    // If no valid cookie, show PIN form
    if (!authCookie || authCookie.value !== 'verified') {
      return <PinForm slug={slug} boardTitle={board.title} />;
    }
  }

  // Convert KV jobs to ParsedJob format for compatibility with existing components
  const jobs: ParsedJob[] = board.jobs.map((job) => ({
    title: job.title,
    company: job.company,
    link: job.link,
    location: job.location,
    employmentType: job.employmentType,
    notes: job.notes,
    status: job.status,
    dueDate: job.dueDate,
    parsedOn: job.parsedOn,
    verified: job.verified,
    customFields: job.customFields,
  }));

  return (
    <main className="page">
      <div className="container-app max-w-5xl">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight overflow-wrap-break-word min-w-0">
              {board.title}
            </h1>
            <PinSettings slug={slug} hasPin={!!board.pin} />
          </div>
        </header>

        {/* Add Job Form */}
        <JobForm slug={slug} columns={board.columns} />

        {/* Column Manager */}
        <ColumnManager slug={slug} columns={board.columns} />

        {/* Jobs List */}
        <JobsView
          jobs={jobs}
          slug={slug}
          columns={board.columns}
          columnOrder={getColumnOrder(board)}
        />
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;

  // Validate slug
  if (!SLUG_REGEX.test(slug)) {
    return { title: 'Board Not Found' };
  }

  const board = await getBoard(slug);

  if (!board) {
    return { title: 'Board Not Found' };
  }

  return {
    title: board.title,
    description: `${board.title} - Personal Job Board`,
  };
}
