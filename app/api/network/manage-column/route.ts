import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { removeCustomColumn, updateCustomColumn } from '@/lib/custom-column-utils';
import type { Column } from '@/lib/markdown';
import { fail } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { action, columnName, column, updates } = (body ?? {}) as {
      action?: unknown;
      columnName?: unknown;
      column?: unknown;
      updates?: unknown;
    };

    if (typeof columnName !== 'string' || !columnName) {
      return NextResponse.json({ error: 'columnName is required' }, { status: 400 });
    }

    const result = await withNetwork(userId, (network) => {
      if (action === 'delete') {
        return removeCustomColumn(network, network.people, columnName);
      }
      if (action === 'update' && (column || updates)) {
        const existing = network.columns.find((c) => c.name === columnName);
        if (!existing) return fail(404, 'Column not found');
        const next: unknown =
          column ?? (updates && typeof updates === 'object' ? { ...existing, ...updates } : null);
        return updateCustomColumn(network, network.people, columnName, next as Column, 'network');
      }
      return fail(400, 'Invalid action');
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Manage column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to manage column' },
      { status: 500 }
    );
  }
}
