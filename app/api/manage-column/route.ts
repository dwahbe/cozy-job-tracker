import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import {
  removeCustomColumn,
  reorderCustomColumns,
  updateCustomColumn,
} from '@/lib/custom-column-utils';

export const runtime = 'nodejs';

// PUT - Update column
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { oldName, column } = (body ?? {}) as { oldName?: unknown; column?: unknown };
    if (typeof oldName !== 'string' || !oldName) {
      return NextResponse.json({ error: 'oldName is required' }, { status: 400 });
    }

    const result = await withBoard(userId, (board) =>
      updateCustomColumn(board, board.jobs, oldName, column, 'board')
    );
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update column' },
      { status: 500 }
    );
  }
}

// PATCH - Reorder custom columns
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { columnOrder } = (body ?? {}) as { columnOrder?: unknown };

    const result = await withBoard(userId, (board) => reorderCustomColumns(board, columnOrder));
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

// DELETE - Remove column
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const columnName = request.nextUrl.searchParams.get('name');
    if (!columnName) {
      return NextResponse.json({ error: 'Column name is required' }, { status: 400 });
    }

    const result = await withBoard(userId, (board) =>
      removeCustomColumn(board, board.jobs, columnName)
    );
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete column' },
      { status: 500 }
    );
  }
}
