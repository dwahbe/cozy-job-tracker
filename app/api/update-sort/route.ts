import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { MAX_SORT_RULES } from '@/lib/limits';
import { ok } from '@/lib/outcome';
import type { SortRule } from '@/lib/kv';

export const runtime = 'nodejs';

function isSortRule(rule: unknown): rule is SortRule {
  if (!rule || typeof rule !== 'object') return false;
  const { field, direction } = rule as Partial<SortRule>;
  return (
    typeof field === 'string' &&
    field.length > 0 &&
    field.length <= 100 &&
    (direction === 'asc' || direction === 'desc')
  );
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { sortPreference } = (body ?? {}) as { sortPreference?: unknown };

    if (!Array.isArray(sortPreference) || !sortPreference.every(isSortRule)) {
      return NextResponse.json(
        { error: 'sortPreference must be an array of { field, direction } rules' },
        { status: 400 }
      );
    }
    if (sortPreference.length > MAX_SORT_RULES) {
      return NextResponse.json(
        { error: `You can sort by up to ${MAX_SORT_RULES} fields` },
        { status: 400 }
      );
    }

    const result = await withBoard(userId, (board) => {
      board.sortPreference = sortPreference.map(({ field, direction }) => ({ field, direction }));
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update sort error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update sort preference' },
      { status: 500 }
    );
  }
}
