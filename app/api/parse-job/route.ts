import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchPage } from '@/lib/fetchPage';
import { extractJob } from '@/lib/extractJob';
import { validateExtraction } from '@/lib/validateExtraction';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { url } = body as { url?: unknown };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Fetch the page
    const pageResult = await fetchPage(url);

    const shouldFailFast =
      !!pageResult.fetchError &&
      (pageResult.text.length === 0 ||
        pageResult.errorType === 'bot_protection' ||
        pageResult.errorType === 'http_error' ||
        pageResult.errorType === 'network_error');

    if (shouldFailFast) {
      return NextResponse.json(
        {
          error: pageResult.fetchError,
          errorType: pageResult.errorType,
          finalUrl: pageResult.finalUrl,
          fetchedAt: pageResult.fetchedAt,
        },
        { status: 422 }
      );
    }

    // Extract job data using OpenAI
    const extraction = await extractJob(
      pageResult.text,
      pageResult.title,
      pageResult.finalUrl,
      pageResult.structured
    );

    // Validate the extraction against source text
    const validatedJob = validateExtraction(
      extraction,
      pageResult.text,
      pageResult.fetchedAt,
      pageResult.finalUrl
    );

    return NextResponse.json({
      job: validatedJob,
      fetchWarning: pageResult.fetchError,
    });
  } catch (error) {
    console.error('Parse job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse job' },
      { status: 500 }
    );
  }
}
