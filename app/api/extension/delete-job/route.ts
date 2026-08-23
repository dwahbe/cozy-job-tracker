import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import type { TrashedJob } from '@/lib/kv';
import { outcomeError, unauthorized, withBoard } from '@/lib/api-auth';
import { fail, ok } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    const { jobId } = (body ?? {}) as { jobId?: unknown };
    if (typeof jobId !== 'string' || !jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const result = await withBoard(user.userId, (board) => {
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
    console.error('Extension delete-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete job' },
      { status: 500 }
    );
  }
}
