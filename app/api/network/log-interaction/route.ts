import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { logInteraction } from '@/lib/job-updates';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { personId, type, note, followUpDate } = (body ?? {}) as {
      personId?: unknown;
      type?: unknown;
      note?: unknown;
      followUpDate?: unknown;
    };

    const result = await withNetwork(userId, (network) =>
      logInteraction(network, personId, { type, note, followUpDate })
    );
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ interactionId: result.value.interaction.id });
  } catch (error) {
    console.error('Log interaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to log interaction' },
      { status: 500 }
    );
  }
}
