import { verifySession } from '@/lib/dal';
import { getOrCreateBoard, pruneTrash } from '@/lib/kv';
import { withBoard } from '@/lib/api-auth';
import { ok, unchanged } from '@/lib/outcome';
import { TrashList } from '@/app/components/TrashList';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TrashPage() {
  const { userId } = await verifySession();

  const board = await getOrCreateBoard(userId);

  // Auto-prune expired trash items (compare-and-set so it can't clobber a concurrent edit)
  if (pruneTrash(board)) {
    await withBoard(userId, (fresh) => (pruneTrash(fresh) ? ok() : unchanged()), {
      revalidate: false,
    });
  }

  const trashItems = board.trash || [];

  return (
    <main className="page">
      <div className="container-app max-w-3xl">
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/board" className="text-sm muted hover:text-foreground transition-colors">
              ← Back to board
            </Link>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">Trash</h1>
        </header>

        <TrashList items={trashItems} />
      </div>
    </main>
  );
}

export function generateMetadata() {
  return {
    title: 'Trash — cozy job tracker',
    description: 'Recently deleted jobs',
  };
}
