import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { addCustomColumn } from '@/lib/custom-column-utils';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { column } = (body ?? {}) as { column?: unknown };

    const result = await withBoard(userId, (board) =>
      addCustomColumn(board, board.jobs, column, 'board')
    );
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add column' },
      { status: 500 }
    );
  }
}
