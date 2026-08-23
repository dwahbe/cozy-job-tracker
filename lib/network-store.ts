import 'server-only';
import { redis } from '@/lib/redis';
import { createEmptyNetwork } from '@/lib/network';
import type { NetworkData } from '@/lib/network';

/**
 * Redis access for network documents (one JSON blob per user at `network:{userId}`). Kept apart
 * from lib/network.ts, whose pure helpers the client components share, so the Redis client never
 * ends up in the browser bundle. Writes go through withNetwork() (lib/network-auth.ts).
 */

export function networkKey(userId: string): string {
  return `network:${userId}`;
}

export async function getNetworkByUserId(userId: string): Promise<NetworkData | null> {
  return await redis.get<NetworkData>(networkKey(userId));
}

/**
 * The user's network, or an empty one if they haven't got one yet. Nothing is written here: the
 * first compare-and-set write (withNetwork) creates the key, so a slow first-use create can never
 * overwrite an edit that landed in the meantime.
 */
export async function getNetworkOrDefault(userId: string): Promise<NetworkData> {
  return (await getNetworkByUserId(userId)) ?? createEmptyNetwork();
}
