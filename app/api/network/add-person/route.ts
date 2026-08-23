import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { addPerson } from '@/lib/job-updates';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);

    const result = await withNetwork(userId, (network) => addPerson(network, body));
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ personId: result.value.id });
  } catch (error) {
    console.error('Add person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add person' },
      { status: 500 }
    );
  }
}
