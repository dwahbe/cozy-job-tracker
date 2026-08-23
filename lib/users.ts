import 'server-only';
import { kv } from '@vercel/kv';

/** Auth.js adapter keys that live under user:* but are not user records */
export const NON_USER_KEY = /^user:(email|account|session|token):/;

/** Keys of every user record (`user:{id}`). */
export async function listUserKeys(): Promise<string[]> {
  const keys = await kv.keys('user:*');
  return keys.filter((k) => !NON_USER_KEY.test(k));
}

export async function countUsers(): Promise<number> {
  return (await listUserKeys()).length;
}
