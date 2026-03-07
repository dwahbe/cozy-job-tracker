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

    if (!ctx.network.trash || ctx.network.trash.length === 0) {
      return NextResponse.json({ error: 'Trash is empty' }, { status: 404 });
    }

    const trashIndex = ctx.network.trash.findIndex((p) => p.id === personId);
    if (trashIndex === -1) {
      return NextResponse.json({ error: 'Person not found in trash' }, { status: 404 });
    }

    const [trashedPerson] = ctx.network.trash.splice(trashIndex, 1);
    const { deletedAt: _, ...restoredPerson } = trashedPerson;
    ctx.network.people.unshift(restoredPerson);

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Restore person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore person' },
      { status: 500 }
    );
  }
}
