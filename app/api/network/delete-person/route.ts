import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import type { TrashedPerson } from '@/lib/network';
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
      const idx = network.people.findIndex((p) => p.id === personId);
      if (idx === -1) return fail(404, 'Person not found');

      const [person] = network.people.splice(idx, 1);
      const trashedPerson: TrashedPerson = { ...person, deletedAt: new Date().toISOString() };
      if (!network.trash) network.trash = [];
      network.trash.unshift(trashedPerson);
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete person' },
      { status: 500 }
    );
  }
}
