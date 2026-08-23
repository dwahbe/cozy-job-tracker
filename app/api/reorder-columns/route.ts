import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { getColumnOrderError } from '@/lib/custom-column-utils';
import { ok } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { columnOrder } = (body ?? {}) as { columnOrder?: unknown };
    const orderError = getColumnOrderError(columnOrder);
    if (orderError) return NextResponse.json({ error: orderError }, { status: 400 });

    const result = await withBoard(userId, (board) => {
      board.columnOrder = columnOrder as string[];
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder columns error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder columns' },
      { status: 500 }
    );
  }
}
