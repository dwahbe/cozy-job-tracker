import { verifySession } from '@/lib/dal';
import { getNetworkColumnOrder, pruneNetworkTrash } from '@/lib/network';
import { getNetworkOrDefault } from '@/lib/network-store';
import { withNetwork } from '@/lib/network-auth';
import { ok, unchanged } from '@/lib/outcome';
import { getBoardByUserId } from '@/lib/kv';
import { NetworkView } from '@/app/components/NetworkView';
import { RefreshOnFocus } from '@/app/components/RefreshOnFocus';
import type { ParsedJob } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

export default async function NetworkPage() {
  const { userId, name: userName } = await verifySession();

  const network = await getNetworkOrDefault(userId);

  // Persist the prune with a compare-and-set write so it can't clobber a concurrent edit.
  if (pruneNetworkTrash(network)) {
    await withNetwork(userId, (fresh) => (pruneNetworkTrash(fresh) ? ok() : unchanged()), {
      revalidate: false,
    });
  }

  const board = await getBoardByUserId(userId);
  const jobs: ParsedJob[] = (board?.jobs ?? []).map((job) => ({
    id: job.id,
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
      <RefreshOnFocus />
      <div className="container-app max-w-6xl">
        <NetworkView
          people={network.people}
          columns={network.columns}
          columnOrder={getNetworkColumnOrder(network)}
          showLinkedJobs={network.showLinkedJobs ?? false}
          jobs={jobs}
          userName={userName}
          trashCount={network.trash?.length ?? 0}
        />
      </div>
    </main>
  );
}

export function generateMetadata() {
  return {
    title: 'Network — cozy job tracker',
    description: 'Your professional network',
  };
}
