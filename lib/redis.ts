import { Redis } from '@upstash/redis';

// The one Redis client for the app. Vercel's KV integration injects KV_REST_API_* (not the
// UPSTASH_REDIS_REST_* names), so this can't use Redis.fromEnv().
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
