import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { getBoardByUserId, saveBoardByUserId, createJobFromValidation } from '@/lib/kv';
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
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const board = await getBoardByUserId(user.userId);
    if (!board) {
      return NextResponse.json(
        { error: 'Board not found. Create a board on cozyjobtracker.com first.' },
        { status: 404 }
      );
    }

    // Fetch page content
    const pageResult = await fetchPage(url);

    if (pageResult.fetchError && pageResult.text.length === 0) {
      return NextResponse.json(
        { error: pageResult.fetchError, errorType: pageResult.errorType },
        { status: 422 }
      );
    }

    // Extract job data via OpenAI
    const extraction = await extractJob(pageResult.text, pageResult.title, pageResult.finalUrl);

    // Validate extraction against source text
    const validatedJob = validateExtraction(
      extraction,
      pageResult.text,
      pageResult.fetchedAt,
      pageResult.finalUrl
    );

    const newJob = createJobFromValidation(validatedJob, board.columns);

    board.jobs.push(newJob);
    await saveBoardByUserId(user.userId, board);
    revalidatePath('/board');

    return NextResponse.json({
      success: true,
      title: newJob.title,
      company: newJob.company,
      ...(pageResult.fetchError ? { warning: pageResult.fetchError } : {}),
    });
  } catch (error) {
    console.error('Extension add-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add job' },
      { status: 500 }
    );
  }
}
