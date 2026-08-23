import { NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { ok, unchanged } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const result = await withNetwork(userId, (network) => {
      if (!network.trash || network.trash.length === 0) return unchanged();
      network.trash = [];
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Empty network trash error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to empty trash' },
      { status: 500 }
    );
  }
}
