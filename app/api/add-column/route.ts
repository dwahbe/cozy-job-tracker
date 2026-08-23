import { NextRequest, NextResponse } from 'next/server';
import { type Column } from '@/lib/kv';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

const VALID_COLUMN_TYPES = ['text', 'checkbox', 'dropdown', 'date'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { column } = body as { column: Column };

    // Validate column
    if (!column || !column.name || !column.type) {
      return NextResponse.json({ error: 'Column name and type are required' }, { status: 400 });
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

    // Resolve the signed-in user's board
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if column already exists
    if (ctx.board.columns.some((c) => c.name.toLowerCase() === column.name.toLowerCase())) {
      return NextResponse.json({ error: 'Column already exists' }, { status: 400 });
    }

    // Add column
    ctx.board.columns.push(column);

    // Add default values for existing jobs
    const defaultValue = column.type === 'checkbox' ? 'No' : '';
    for (const job of ctx.board.jobs) {
      job.customFields[column.name] = defaultValue;
    }

    // Save board
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add column' },
      { status: 500 }
    );
  }
}
