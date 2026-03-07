import { NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    ctx.network.trash = [];

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Empty network trash error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to empty trash' },
      { status: 500 }
    );
  }
}
