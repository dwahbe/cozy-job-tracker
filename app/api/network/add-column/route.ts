import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { addCustomColumn } from '@/lib/custom-column-utils';
import { ok, unchanged } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { column, toggleLinkedJobs } = (body ?? {}) as {
      column?: unknown;
      toggleLinkedJobs?: unknown;
    };

    if (toggleLinkedJobs !== undefined) {
      if (typeof toggleLinkedJobs !== 'boolean') {
        return NextResponse.json({ error: 'toggleLinkedJobs must be a boolean' }, { status: 400 });
      }
      const result = await withNetwork(userId, (network) => {
        if ((network.showLinkedJobs ?? false) === toggleLinkedJobs) return unchanged();
        network.showLinkedJobs = toggleLinkedJobs;
        return ok();
      });
      if (!result.ok) return outcomeError(result);
      return NextResponse.json({ ok: true });
    }

    const result = await withNetwork(userId, (network) =>
      addCustomColumn(network, network.people, column, 'network')
    );
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Add column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add column' },
      { status: 500 }
    );
  }
}
