import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, columnName, updates } = await request.json();

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
      if (ctx.network.columnOrder) {
        ctx.network.columnOrder = ctx.network.columnOrder.filter((c) => c !== columnName);
      }
    } else if (action === 'update' && updates) {
      const col = ctx.network.columns[colIndex];
      const oldName = col.name;

      if (updates.name && updates.name !== oldName) {
        col.name = updates.name;
        for (const person of ctx.network.people) {
          if (oldName in person.customFields) {
            person.customFields[updates.name] = person.customFields[oldName];
            delete person.customFields[oldName];
          }
        }
        if (ctx.network.columnOrder) {
          ctx.network.columnOrder = ctx.network.columnOrder.map((c) =>
            c === oldName ? updates.name : c
          );
        }
      }
      if (updates.type) col.type = updates.type;
      if (updates.options) col.options = updates.options;
      if (updates.optionColors !== undefined) col.optionColors = updates.optionColors;
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
