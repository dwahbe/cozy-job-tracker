import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { columnOrder } = body as {
      columnOrder: string[];
    };

    // Validate columnOrder
    if (!Array.isArray(columnOrder)) {
      return NextResponse.json({ error: 'columnOrder must be an array' }, { status: 400 });
    }

    // Resolve the signed-in user's board
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Save the new column order
    ctx.board.columnOrder = columnOrder;

    // Save board
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder columns error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder columns' },
      { status: 500 }
    );
  }
}
