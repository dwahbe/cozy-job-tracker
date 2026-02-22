import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { getBoardByUserId, pruneTrash } from '@/lib/kv';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const board = await getBoardByUserId(user.userId);
    if (!board) {
      return NextResponse.json(
        { error: 'Board not found. Create a board on cozyjobtracker.com first.' },
        { status: 404 }
      );
    }

    pruneTrash(board);

    return NextResponse.json({
      title: board.title,
      columns: board.columns,
      columnOrder: board.columnOrder,
      sortPreference: board.sortPreference,
      jobs: board.jobs,
      trashCount: board.trash?.length ?? 0,
    });
  } catch (error) {
    console.error('Extension board read error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read board' },
      { status: 500 }
    );
  }
}
