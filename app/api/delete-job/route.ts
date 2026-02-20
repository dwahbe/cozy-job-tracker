import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';
import type { TrashedJob } from '@/lib/kv';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, jobLink, jobId } = body as { slug: string; jobLink?: string; jobId?: string };

    if (!jobLink && !jobId) {
      return NextResponse.json({ error: 'jobLink or jobId is required' }, { status: 400 });
    }

    // Resolve board (auth session or legacy slug)
    const ctx = await resolveBoard(slug);
    if (!ctx) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Find the job — prefer id (always unique), fall back to link
    const jobIndex = ctx.board.jobs.findIndex(
      (j) => (jobId && j.id === jobId) || (jobLink && j.link === jobLink)
    );
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
