import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getBoard, saveBoard, type Column } from '@/lib/kv';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;
const VALID_COLUMN_TYPES = ['text', 'checkbox', 'dropdown'];

// PUT - Update column
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, oldName, column } = body as {
      slug: string;
      oldName: string;
      column: Column;
    };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board slug or board not found' }, { status: 400 });
    }

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

    if (column.type === 'dropdown' && (!column.options || column.options.length === 0)) {
      return NextResponse.json(
        { error: 'Dropdown columns require at least one option' },
        { status: 400 }
      );
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Find the column
    const columnIndex = board.columns.findIndex(
      (c) => c.name.toLowerCase() === oldName.toLowerCase()
    );
    if (columnIndex === -1) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    // If renaming, check new name doesn't conflict
    if (oldName.toLowerCase() !== column.name.toLowerCase()) {
      if (board.columns.some((c) => c.name.toLowerCase() === column.name.toLowerCase())) {
        return NextResponse.json(
          { error: 'Column with that name already exists' },
          { status: 400 }
        );
      }
    }

    // Update column
    board.columns[columnIndex] = column;

    // If renamed, update custom fields in all jobs
    if (oldName !== column.name) {
      for (const job of board.jobs) {
        if (oldName in job.customFields) {
          job.customFields[column.name] = job.customFields[oldName];
          delete job.customFields[oldName];
        }
      }
    }

    // Save board
    await saveBoard(slug, board);

    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update column' },
      { status: 500 }
    );
  }
}

// DELETE - Remove column
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const columnName = searchParams.get('name');

    if (!slug || !columnName) {
      return NextResponse.json({ error: 'Slug and column name are required' }, { status: 400 });
    }

    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board slug' }, { status: 400 });
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Find and remove the column
    const columnIndex = board.columns.findIndex(
      (c) => c.name.toLowerCase() === columnName.toLowerCase()
    );
    if (columnIndex === -1) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    const removedColumn = board.columns[columnIndex];
    board.columns.splice(columnIndex, 1);

    // Remove custom field from all jobs
    for (const job of board.jobs) {
      delete job.customFields[removedColumn.name];
    }

    // Save board
    await saveBoard(slug, board);

    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete column' },
      { status: 500 }
    );
  }
}
