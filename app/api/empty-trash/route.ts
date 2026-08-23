import { NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { ok, unchanged } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const result = await withBoard(userId, (board) => {
      if (!board.trash || board.trash.length === 0) return unchanged();
      board.trash = [];
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Empty trash error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to empty trash' },
      { status: 500 }
    );
  }
}
