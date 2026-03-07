import { auth } from '@/auth';
import { getNetworkByUserId, saveNetworkByUserId } from '@/lib/network';
import type { NetworkData } from '@/lib/network';
import { revalidatePath } from 'next/cache';

export interface NetworkContext {
  network: NetworkData;
  userId: string;
}

/**
 * Resolve the network for an authenticated API request.
 * Returns null if not authenticated or no network exists.
 * Creates an empty network if one doesn't exist yet.
 */
export async function resolveNetwork(): Promise<NetworkContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  let network = await getNetworkByUserId(session.user.id);
  if (!network) {
    network = { people: [], columns: [] };
    await saveNetworkByUserId(session.user.id, network);
  }

  return { network, userId: session.user.id };
}

/**
 * Save network data and revalidate the network page.
 */
export async function saveNetworkAndRevalidate(ctx: NetworkContext): Promise<void> {
  await saveNetworkByUserId(ctx.userId, ctx.network);
  revalidatePath('/network');
  revalidatePath('/network/trash');
}
