import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Redis } from '@upstash/redis';
import { DISPLAY_NAME_MAX } from '@/lib/limits';

export const runtime = 'nodejs';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { name } = body as { name?: unknown };
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const trimmed = name.trim();
    if (trimmed.length > DISPLAY_NAME_MAX) {
      return NextResponse.json(
        { error: `Name must be ${DISPLAY_NAME_MAX} characters or fewer` },
        { status: 400 }
      );
    }

    // Update the user record in Redis (Auth.js stores users as user:{id})
    const userKey = `user:${session.user.id}`;
    const user = await redis.get(userKey);
    if (user && typeof user === 'object') {
      await redis.set(userKey, { ...user, name: trimmed });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Update name error:', error);
    return NextResponse.json({ error: 'Failed to update name' }, { status: 500 });
  }
}
