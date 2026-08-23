import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { fail, ok } from '@/lib/outcome';
import type { TrashedJob } from '@/lib/kv';

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

    // Move to trash instead of deleting outright (restorable for 30 days).
    const result = await withBoard(userId, (board) => {
      const jobIndex = board.jobs.findIndex((j) => j.id === jobId);
      if (jobIndex === -1) return fail(404, 'Job not found');

      const [job] = board.jobs.splice(jobIndex, 1);
      const trashedJob: TrashedJob = { ...job, deletedAt: new Date().toISOString() };
      if (!board.trash) board.trash = [];
      board.trash.unshift(trashedJob);
      return ok();
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete job' },
      { status: 500 }
    );
  }
}
