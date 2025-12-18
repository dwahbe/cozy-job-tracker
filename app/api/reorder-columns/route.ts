import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getBoard, saveBoard } from '@/lib/kv';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, columnOrder } = body as {
      slug: string;
      columnOrder: string[];
    };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board slug' }, { status: 400 });
    }

    // Validate columnOrder
    if (!Array.isArray(columnOrder)) {
      return NextResponse.json({ error: 'columnOrder must be an array' }, { status: 400 });
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Save the new column order
    board.columnOrder = columnOrder;

    // Save board
    await saveBoard(slug, board);

    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder columns error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder columns' },
      { status: 500 }
    );
  }
}
