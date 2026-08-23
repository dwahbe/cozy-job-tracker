import { NextRequest, NextResponse } from 'next/server';
import { type Column } from '@/lib/kv';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';
import {
  getColumnValidationError,
  removeColumnFromOrder,
  renameColumnInOrder,
} from '@/lib/custom-column-utils';

export const runtime = 'nodejs';

// PUT - Update column
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldName, column } = body as {
      oldName: string;
      column: Column;
    };

    // Validate column
    const validationError = getColumnValidationError(column);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Resolve the signed-in user's board
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the column
    const columnIndex = ctx.board.columns.findIndex(
      (c) => c.name.toLowerCase() === oldName.toLowerCase()
    );
    if (columnIndex === -1) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    // If renaming, check new name doesn't conflict
    if (oldName.toLowerCase() !== column.name.toLowerCase()) {
      if (ctx.board.columns.some((c) => c.name.toLowerCase() === column.name.toLowerCase())) {
        return NextResponse.json(
          { error: 'Column with that name already exists' },
          { status: 400 }
        );
      }
    }

    // Update column
    ctx.board.columns[columnIndex] = column;

    // If renamed, update custom fields in all jobs
    if (oldName !== column.name) {
      ctx.board.columnOrder = renameColumnInOrder(ctx.board.columnOrder, oldName, column.name);
      for (const job of ctx.board.jobs) {
        if (oldName in job.customFields) {
          job.customFields[column.name] = job.customFields[oldName];
          delete job.customFields[oldName];
        }
      }
    }

    // Save board
    await saveBoardAndRevalidate(ctx);

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

    // Verify all column names exist
    const existingNames = new Set(ctx.board.columns.map((c) => c.name));
    for (const name of columnOrder) {
      if (!existingNames.has(name)) {
        return NextResponse.json({ error: `Column "${name}" not found` }, { status: 400 });
      }
    }

    // Reorder columns based on columnOrder
    const columnMap = new Map(ctx.board.columns.map((c) => [c.name, c]));
    ctx.board.columns = columnOrder.map((name) => columnMap.get(name)!);

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

// DELETE - Remove column
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const columnName = searchParams.get('name');

    if (!columnName) {
      return NextResponse.json({ error: 'Column name is required' }, { status: 400 });
    }

    // Resolve the signed-in user's board
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find and remove the column
    const columnIndex = ctx.board.columns.findIndex(
      (c) => c.name.toLowerCase() === columnName.toLowerCase()
    );
    if (columnIndex === -1) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    const removedColumn = ctx.board.columns[columnIndex];
    ctx.board.columns.splice(columnIndex, 1);
    ctx.board.columnOrder = removeColumnFromOrder(ctx.board.columnOrder, removedColumn.name);

    // Remove custom field from all jobs
    for (const job of ctx.board.jobs) {
      delete job.customFields[removedColumn.name];
    }

    // Save board
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete column' },
      { status: 500 }
    );
  }
}
