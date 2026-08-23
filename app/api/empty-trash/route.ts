import { NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    ctx.board.trash = [];

    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Empty trash error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to empty trash' },
      { status: 500 }
    );
  }
}
