import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';
import type { Column } from '@/lib/markdown';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { column, toggleLinkedJobs } = (await request.json()) as {
      column?: Column;
      toggleLinkedJobs?: boolean;
    };

    if (toggleLinkedJobs !== undefined) {
      ctx.network.showLinkedJobs = toggleLinkedJobs;
      await saveNetworkAndRevalidate(ctx);
      return NextResponse.json({ ok: true });
    }

    if (!column || !column.name || !column.type) {
      return NextResponse.json({ error: 'Column name and type are required' }, { status: 400 });
    }

    const validTypes = ['text', 'checkbox', 'dropdown', 'date'];
    if (!validTypes.includes(column.type)) {
      return NextResponse.json({ error: 'Invalid column type' }, { status: 400 });
    }

    if (column.type === 'dropdown' && (!column.options || column.options.length === 0)) {
      return NextResponse.json(
        { error: 'Dropdown columns require at least one option' },
        { status: 400 }
      );
    }

    const exists = ctx.network.columns.some(
      (c) => c.name.toLowerCase() === column.name.toLowerCase()
    );
    if (exists) {
      return NextResponse.json(
        { error: 'A column with this name already exists' },
        { status: 409 }
      );
    }

    ctx.network.columns.push(column);

    const defaultValue = column.type === 'checkbox' ? 'No' : '';
    for (const person of ctx.network.people) {
      if (!(column.name in person.customFields)) {
        person.customFields[column.name] = defaultValue;
      }
    }

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Add column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add column' },
      { status: 500 }
    );
  }
}
