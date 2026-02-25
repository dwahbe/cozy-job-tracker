import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { personId } = await request.json();
    if (!personId) {
      return NextResponse.json({ error: 'personId is required' }, { status: 400 });
    }

    const before = ctx.network.people.length;
    ctx.network.people = ctx.network.people.filter((p) => p.id !== personId);

    if (ctx.network.people.length === before) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete person' },
      { status: 500 }
    );
  }
}
