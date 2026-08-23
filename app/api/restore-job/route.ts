import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { fail, ok } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { jobId } = (body ?? {}) as { jobId?: unknown };
    if (typeof jobId !== 'string' || !jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const result = await withBoard(userId, (board) => {
      if (!board.trash || board.trash.length === 0) return fail(404, 'Trash is empty');

      const trashIndex = board.trash.findIndex((j) => j.id === jobId);
      if (trashIndex === -1) return fail(404, 'Job not found in trash');

      const [trashedJob] = board.trash.splice(trashIndex, 1);
      const { deletedAt: _, ...restoredJob } = trashedJob;
      board.jobs.unshift(restoredJob);
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Restore job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore job' },
      { status: 500 }
    );
  }
}
