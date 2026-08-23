import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { fail, ok } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { personId } = (body ?? {}) as { personId?: unknown };
    if (typeof personId !== 'string' || !personId) {
      return NextResponse.json({ error: 'personId is required' }, { status: 400 });
    }

    const result = await withNetwork(userId, (network) => {
      if (!network.trash || network.trash.length === 0) return fail(404, 'Trash is empty');

      const trashIndex = network.trash.findIndex((p) => p.id === personId);
      if (trashIndex === -1) return fail(404, 'Person not found in trash');

      const [trashedPerson] = network.trash.splice(trashIndex, 1);
      const { deletedAt: _, ...restoredPerson } = trashedPerson;
      network.people.unshift(restoredPerson);
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Restore person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore person' },
      { status: 500 }
    );
  }
}
