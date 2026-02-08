import { verifySession } from '@/lib/dal';
import { getBoardByUserId, saveBoardByUserId, getColumnOrder } from '@/lib/kv';
import { JobForm } from '@/app/components/JobForm';
import { JobsView } from '@/app/components/JobsView';
import { ColumnManager } from '@/app/components/ColumnManager';
import { ImportBoardButton } from '@/app/components/ImportBoardButton';
import { TrashButton } from '@/app/components/TrashButton';
import type { ParsedJob } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const { userId } = await verifySession();

  // Load or create board for this user
  let board = await getBoardByUserId(userId);
  if (!board) {
    board = {
      title: 'My job board',
      columns: [],
      jobs: [],
    };
    await saveBoardByUserId(userId, board);
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
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{board.title}</h1>
            <ImportBoardButton />
          </div>
        </header>

        {/* Add Job Form */}
        <JobForm slug={userId} columns={board.columns} />

        {/* Column Manager */}
        <ColumnManager slug={userId} columns={board.columns} />

        {/* Jobs List */}
        <JobsView
          jobs={jobs}
          slug={userId}
          columns={board.columns}
          columnOrder={getColumnOrder(board)}
        />

        {/* Trash link */}
        <TrashButton count={board.trash?.length ?? 0} />
      </div>
    </main>
  );
}

export function generateMetadata() {
  return {
    title: 'My board - cozy job tracker',
    description: 'Your personal job board',
  };
}
