import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { columnOrder } = await request.json();

    if (!Array.isArray(columnOrder)) {
      return NextResponse.json({ error: 'columnOrder must be an array' }, { status: 400 });
    }

    ctx.network.columnOrder = columnOrder;
    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reorder columns error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder columns' },
      { status: 500 }
    );
  }
}
