import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getBoard, saveBoard } from '@/lib/kv';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, jobLink } = body as { slug: string; jobLink: string };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board slug' }, { status: 400 });
    }

    // Validate jobLink
    if (!jobLink) {
      return NextResponse.json({ error: 'jobLink is required' }, { status: 400 });
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Find and remove the job
    const jobIndex = board.jobs.findIndex((j) => j.link === jobLink);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    board.jobs.splice(jobIndex, 1);

    // Save board
    await saveBoard(slug, board);

    // Revalidate the board page
    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete job' },
      { status: 500 }
    );
  }
}
