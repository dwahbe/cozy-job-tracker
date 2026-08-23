import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';
import type { TrashedJob } from '@/lib/kv';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body as { jobId?: string };

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Resolve the signed-in user's board
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the job by id
    const jobIndex = ctx.board.jobs.findIndex((j) => j.id === jobId);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Move to trash instead of permanent delete
    const [job] = ctx.board.jobs.splice(jobIndex, 1);
    const trashedJob: TrashedJob = { ...job, deletedAt: new Date().toISOString() };

    if (!ctx.board.trash) ctx.board.trash = [];
    ctx.board.trash.unshift(trashedJob);

    // Save board
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete job' },
      { status: 500 }
    );
  }
}
