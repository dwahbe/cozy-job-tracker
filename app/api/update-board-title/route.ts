import { NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { BOARD_TITLE_MAX } from '@/lib/limits';
import { ok, unchanged } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { title } = body as { title?: unknown };
    if (typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const trimmed = title.trim();
    if (trimmed.length > BOARD_TITLE_MAX) {
      return NextResponse.json(
        { error: `Title must be ${BOARD_TITLE_MAX} characters or fewer` },
        { status: 400 }
      );
    }

    const result = await withBoard(userId, (board) => {
      if (board.title === trimmed) return unchanged();
      board.title = trimmed;
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Update board title error:', error);
    return NextResponse.json({ error: 'Failed to update title' }, { status: 500 });
  }
}
