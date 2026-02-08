import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await request.json();
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Update the user record in Redis (Auth.js stores users as user:{id})
  const userKey = `user:${session.user.id}`;
  const user = await redis.get(userKey);
  if (user && typeof user === 'object') {
    await redis.set(userKey, { ...user, name: name.trim() });
  }

  return NextResponse.json({ ok: true });
}
