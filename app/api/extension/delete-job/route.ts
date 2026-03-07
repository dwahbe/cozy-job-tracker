import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { getBoardByUserId, saveBoardByUserId } from '@/lib/kv';
import type { TrashedJob } from '@/lib/kv';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobId } = body as { jobId?: string };

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const board = await getBoardByUserId(user.userId);
    if (!board) {
      return NextResponse.json(
        { error: 'Board not found. Create a board on cozyjobtracker.com first.' },
        { status: 404 }
      );
    }

    const jobIndex = board.jobs.findIndex((j) => j.id === jobId);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const [job] = board.jobs.splice(jobIndex, 1);
    const trashedJob: TrashedJob = { ...job, deletedAt: new Date().toISOString() };

    if (!board.trash) board.trash = [];
    board.trash.unshift(trashedJob);

    await saveBoardByUserId(user.userId, board);
    revalidatePath('/board');
    revalidatePath('/board/trash');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Extension delete-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete job' },
      { status: 500 }
    );
  }
}
