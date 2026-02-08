import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug } = body as { slug: string };

    const ctx = await resolveBoard(slug);
    if (!ctx) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
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
