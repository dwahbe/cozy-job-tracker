import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getBoard, saveBoard, type Column } from '@/lib/kv';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;
const VALID_COLUMN_TYPES = ['text', 'checkbox', 'dropdown'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, column } = body as { slug: string; column: Column };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid board slug' },
        { status: 400 }
      );
    }

    // Validate column
    if (!column || !column.name || !column.type) {
      return NextResponse.json(
        { error: 'Column name and type are required' },
        { status: 400 }
      );
    }

    if (!VALID_COLUMN_TYPES.includes(column.type)) {
      return NextResponse.json(
        { error: `Column type must be one of: ${VALID_COLUMN_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Dropdown columns need options
    if (column.type === 'dropdown' && (!column.options || column.options.length === 0)) {
      return NextResponse.json(
        { error: 'Dropdown columns require at least one option' },
        { status: 400 }
      );
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if column already exists
    if (board.columns.some(c => c.name.toLowerCase() === column.name.toLowerCase())) {
      return NextResponse.json(
        { error: 'Column already exists' },
        { status: 400 }
      );
    }

    // Add column
    board.columns.push(column);

    // Add default values for existing jobs
    const defaultValue = column.type === 'checkbox' ? 'No' : '';
    for (const job of board.jobs) {
      job.customFields[column.name] = defaultValue;
    }

    // Save board
    await saveBoard(slug, board);

    // Revalidate the board page
    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add column' },
      { status: 500 }
    );
  }
}
