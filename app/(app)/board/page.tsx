import { verifySession } from '@/lib/dal';
import { getOrCreateBoard, getColumnOrder, pruneTrash } from '@/lib/kv';
import { withBoard } from '@/lib/api-auth';
import { ok, unchanged } from '@/lib/outcome';
import { JobForm } from '@/app/components/JobForm';
import { JobsView } from '@/app/components/JobsView';
import { ColumnManager } from '@/app/components/ColumnManager';
import { TrashButton } from '@/app/components/TrashButton';
import { RefreshOnFocus } from '@/app/components/RefreshOnFocus';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const { userId } = await verifySession();

  const board = await getOrCreateBoard(userId);

  // Persist the prune with a compare-and-set write so it can't clobber a concurrent edit.
  if (pruneTrash(board)) {
    await withBoard(userId, (fresh) => (pruneTrash(fresh) ? ok() : unchanged()), {
      revalidate: false,
    });
  }

  return (
    <main className="page">
      <RefreshOnFocus />
      <div className="container-app max-w-5xl">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{board.title}</h1>
        </header>

        {/* Add Job Form */}
        <JobForm columns={board.columns} />

        {/* Column Manager */}
        <ColumnManager columns={board.columns} />

        {/* Jobs List */}
        <JobsView
          jobs={board.jobs}
          columns={board.columns}
          columnOrder={getColumnOrder(board)}
          initialSortPreference={board.sortPreference}
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
