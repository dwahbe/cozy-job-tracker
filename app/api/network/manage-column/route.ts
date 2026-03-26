import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';
import type { Column } from '@/lib/markdown';
import {
  getColumnValidationError,
  removeColumnFromOrder,
  renameColumnInOrder,
  renameCustomFieldKey,
} from '@/lib/custom-column-utils';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, columnName, column, updates } = (await request.json()) as {
      action?: 'delete' | 'update';
      columnName?: string;
      column?: Column;
      updates?: Partial<Column>;
    };

    if (!columnName) {
      return NextResponse.json({ error: 'columnName is required' }, { status: 400 });
    }

    const colIndex = ctx.network.columns.findIndex((c) => c.name === columnName);
    if (colIndex === -1) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    if (action === 'delete') {
      ctx.network.columns.splice(colIndex, 1);
      for (const person of ctx.network.people) {
        delete person.customFields[columnName];
      }
      ctx.network.columnOrder = removeColumnFromOrder(ctx.network.columnOrder, columnName);
    } else if (action === 'update' && (column || updates)) {
      const existingColumn = ctx.network.columns[colIndex];
      const nextColumn: Column = column ?? {
        ...existingColumn,
        ...updates,
      };

      const validationError = getColumnValidationError(nextColumn);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      if (columnName.toLowerCase() !== nextColumn.name.toLowerCase()) {
        const hasConflict = ctx.network.columns.some(
          (col, index) =>
            index !== colIndex && col.name.toLowerCase() === nextColumn.name.toLowerCase()
        );
        if (hasConflict) {
          return NextResponse.json(
            { error: 'A column with this name already exists' },
            { status: 409 }
          );
        }
      }

      ctx.network.columns[colIndex] = nextColumn;

      if (columnName !== nextColumn.name) {
        for (const person of ctx.network.people) {
          renameCustomFieldKey(person.customFields, columnName, nextColumn.name);
        }
        ctx.network.columnOrder = renameColumnInOrder(
          ctx.network.columnOrder,
          columnName,
          nextColumn.name
        );
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Manage column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to manage column' },
      { status: 500 }
    );
  }
}
