import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body as { jobId: string };

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ctx.board.trash || ctx.board.trash.length === 0) {
      return NextResponse.json({ error: 'Trash is empty' }, { status: 404 });
    }

    // Find the trashed job by id
    const trashIndex = ctx.board.trash.findIndex((j) => j.id === jobId);
    if (trashIndex === -1) {
      return NextResponse.json({ error: 'Job not found in trash' }, { status: 404 });
    }

    // Remove from trash and add back to jobs
    const [trashedJob] = ctx.board.trash.splice(trashIndex, 1);
    const { deletedAt: _, ...restoredJob } = trashedJob;
    ctx.board.jobs.unshift(restoredJob);

    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Restore job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore job' },
      { status: 500 }
    );
  }
}
