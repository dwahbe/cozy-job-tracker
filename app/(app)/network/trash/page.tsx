import { verifySession } from '@/lib/dal';
import { getNetworkByUserId, pruneNetworkTrash } from '@/lib/network';
import { withNetwork } from '@/lib/network-auth';
import { ok, unchanged } from '@/lib/outcome';
import { NetworkTrashList } from '@/app/components/NetworkTrashList';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NetworkTrashPage() {
  const { userId } = await verifySession();

  const network = await getNetworkByUserId(userId);
  if (!network) {
    return (
      <main className="page">
        <div className="container-app max-w-3xl text-center py-16">
          <p className="muted">No network found.</p>
        </div>
      </main>
    );
  }

  if (pruneNetworkTrash(network)) {
    await withNetwork(userId, (fresh) => (pruneNetworkTrash(fresh) ? ok() : unchanged()), {
      revalidate: false,
    });
  }

  const trashItems = network.trash || [];

  return (
    <main className="page">
      <div className="container-app max-w-3xl">
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/network" className="text-sm muted hover:text-foreground transition-colors">
              ← Back to network
            </Link>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">Trash</h1>
        </header>

        <NetworkTrashList items={trashItems} />
      </div>
    </main>
  );
}

export function generateMetadata() {
  return {
    title: 'Network trash — cozy job tracker',
    description: 'Recently deleted people',
  };
}
