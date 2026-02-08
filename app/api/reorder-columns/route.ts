import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, columnOrder } = body as {
      slug: string;
      columnOrder: string[];
    };

    // Validate columnOrder
    if (!Array.isArray(columnOrder)) {
      return NextResponse.json({ error: 'columnOrder must be an array' }, { status: 400 });
    }

    // Resolve board (auth session or legacy slug)
    const ctx = await resolveBoard(slug);
    if (!ctx) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
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
