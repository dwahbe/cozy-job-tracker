import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, jobLink } = body as { slug: string; jobLink: string };

    // Validate jobLink
    if (!jobLink) {
      return NextResponse.json({ error: 'jobLink is required' }, { status: 400 });
    }

    // Resolve board (auth session or legacy slug)
    const ctx = await resolveBoard(slug);
    if (!ctx) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Find and remove the job
    const jobIndex = ctx.board.jobs.findIndex((j) => j.link === jobLink);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    ctx.board.jobs.splice(jobIndex, 1);

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
