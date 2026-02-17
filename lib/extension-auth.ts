import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface Session {
  userId: string;
  expires: string;
  sessionToken: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface ExtensionUser {
  userId: string;
  email: string;
  name: string | null;
}

/**
 * Validate a session token from the Chrome extension.
 * Reads the Bearer token from the Authorization header, looks up
 * the session in Redis (same key pattern as @auth/upstash-redis-adapter),
 * and returns the user info if valid.
 */
export async function validateExtensionToken(req: NextRequest): Promise<ExtensionUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const session = await redis.get<Session>(`user:session:${token}`);
  if (!session) return null;

  if (new Date(session.expires) < new Date()) return null;

  const user = await redis.get<User>(`user:${session.userId}`);
  if (!user) return null;

  return {
    userId: session.userId,
    email: user.email,
    name: user.name,
  };
}
