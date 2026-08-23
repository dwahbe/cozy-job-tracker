import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';
import type { SortRule } from '@/lib/kv';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sortPreference } = body as {
      sortPreference: SortRule[];
    };

    // Validate sortPreference
    if (!Array.isArray(sortPreference)) {
      return NextResponse.json({ error: 'sortPreference must be an array' }, { status: 400 });
    }

    // Resolve the signed-in user's board
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Save the sort preference
    ctx.board.sortPreference = sortPreference;

    // Save board
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update sort error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update sort preference' },
      { status: 500 }
    );
  }
}
