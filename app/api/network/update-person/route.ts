import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { applyPersonUpdates } from '@/lib/job-updates';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { personId, fields } = (body ?? {}) as { personId?: unknown; fields?: unknown };

    if (typeof personId !== 'string' || !personId) {
      return NextResponse.json({ error: 'personId is required' }, { status: 400 });
    }

    const result = await withNetwork(userId, (network) =>
      applyPersonUpdates(network, personId, fields)
    );
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Update person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update person' },
      { status: 500 }
    );
  }
}
