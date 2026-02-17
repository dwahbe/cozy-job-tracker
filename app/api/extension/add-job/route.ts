import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { getBoardByUserId, saveBoardByUserId, generateJobId, type Job } from '@/lib/kv';
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

    // Build custom fields with defaults
    const customFields: Record<string, string> = {};
    for (const col of board.columns) {
      customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
    }

    const newJob: Job = {
      id: generateJobId(),
      title: validatedJob.title || 'Unknown Position',
      company: validatedJob.company || 'Unknown Company',
      link: validatedJob.finalUrl,
      location: validatedJob.location || 'Not listed',
      employmentType: validatedJob.employment_type || 'Not listed',
      notes: validatedJob.notes || '',
      status: 'Saved',
      dueDate: validatedJob.due_date || '',
      parsedOn: validatedJob.fetchedAt.split('T')[0],
      verified: validatedJob.isVerified ? 'Yes' : 'No',
      customFields,
    };

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
