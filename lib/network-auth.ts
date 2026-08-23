import { getOrCreateNetwork, networkKey, type NetworkData } from '@/lib/network';
import { casSet } from '@/lib/cas';
import { fail, type Outcome } from '@/lib/outcome';
import { scheduleRevalidate } from '@/lib/revalidate';

const MAX_ATTEMPTS = 4; // one try plus three retries after a version conflict
const NETWORK_PATHS = ['/network', '/network/trash'];

/**
 * Read → mutate → compare-and-set write for the user's network. Same contract as withBoard():
 * the mutator sees a fresh document, returns ok()/unchanged()/fail(), and is re-run on a
 * version conflict.
 */
export async function withNetwork<T>(
  userId: string,
  mutate: (network: NetworkData) => Outcome<T> | Promise<Outcome<T>>,
  options: { revalidate?: boolean } = {}
): Promise<Outcome<T>> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const network = await getOrCreateNetwork(userId);
    const expected = network.version ?? 0;

    const outcome = await mutate(network);
    if (!outcome.ok || !outcome.changed) return outcome;

    const saved = await casSet(networkKey(userId), expected, {
      ...network,
      version: expected + 1,
    });
    if (saved) {
      if (options.revalidate !== false) scheduleRevalidate(NETWORK_PATHS);
      return outcome;
    }
  }
  return fail(409, 'Your network changed while saving — please try again.');
}
