import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { getBoardByUserId, saveBoardByUserId, createJobFromValidation } from '@/lib/kv';
import type { ValidatedJob } from '@/lib/validateExtraction';
import { fetchPage } from '@/lib/fetchPage';
import { extractJob } from '@/lib/extractJob';
import { validateExtraction } from '@/lib/validateExtraction';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { job, url } = body as { job?: ValidatedJob; url?: string };

    // TODO: remove v1.0 compat once extension v1.1+ is widespread
    const isLegacy = !job && typeof url === 'string';

    let validatedJob: ValidatedJob;
    let fetchWarning: string | undefined;

    if (isLegacy) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }

      const pageResult = await fetchPage(url);

      if (pageResult.fetchError && pageResult.text.length === 0) {
        return NextResponse.json(
          { error: pageResult.fetchError, errorType: pageResult.errorType },
          { status: 422 }
        );
      }

      const extraction = await extractJob(pageResult.text, pageResult.title, pageResult.finalUrl);
      validatedJob = validateExtraction(
        extraction,
        pageResult.text,
        pageResult.fetchedAt,
        pageResult.finalUrl
      );
      fetchWarning = pageResult.fetchError;
    } else if (job?.finalUrl) {
      validatedJob = job;
    } else {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }

    const board = await getBoardByUserId(user.userId);
    if (!board) {
      return NextResponse.json(
        { error: 'Board not found. Create a board on cozyjobtracker.com first.' },
        { status: 404 }
      );
    }

    const newJob = createJobFromValidation(validatedJob, board.columns);

    board.jobs.push(newJob);
    await saveBoardByUserId(user.userId, board);
    revalidatePath('/board');

    return NextResponse.json({
      success: true,
      title: newJob.title,
      company: newJob.company,
      ...(fetchWarning ? { warning: fetchWarning } : {}),
    });
  } catch (error) {
    console.error('Extension add-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add job' },
      { status: 500 }
    );
  }
}
