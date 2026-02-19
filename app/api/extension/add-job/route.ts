import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { getBoardByUserId, saveBoardByUserId, createJobFromValidation } from '@/lib/kv';
import type { ValidatedJob } from '@/lib/validateExtraction';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { job } = body as { job?: ValidatedJob };

    if (!job || !job.finalUrl) {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }

    const board = await getBoardByUserId(user.userId);
    if (!board) {
      return NextResponse.json(
        { error: 'Board not found. Create a board on cozyjobtracker.com first.' },
        { status: 404 }
      );
    }

    const newJob = createJobFromValidation(job, board.columns);

    board.jobs.push(newJob);
    await saveBoardByUserId(user.userId, board);
    revalidatePath('/board');

    return NextResponse.json({
      success: true,
      title: newJob.title,
      company: newJob.company,
    });
  } catch (error) {
    console.error('Extension add-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add job' },
      { status: 500 }
    );
  }
}
