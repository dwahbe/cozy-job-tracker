import 'server-only';
import { redis } from '@/lib/redis';

/** Auth.js adapter keys that live under user:* but are not user records. */
const NON_USER_KEY = /^user:(email|account|session|token):/;

/** Ids of every user record (`user:{id}`). */
export async function listUserIds(): Promise<string[]> {
  const keys = await redis.keys('user:*');
  return keys.filter((key) => !NON_USER_KEY.test(key)).map((key) => key.slice('user:'.length));
}

export async function countUsers(): Promise<number> {
  return (await listUserIds()).length;
}
