import { NextRequest, NextResponse } from 'next/server';
import { fetchPage } from '@/lib/fetchPage';
import { extractJob } from '@/lib/extractJob';
import { validateExtraction } from '@/lib/validateExtraction';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

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

    if (pageResult.fetchError && pageResult.text.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to fetch page',
          details: pageResult.fetchError,
          finalUrl: pageResult.finalUrl,
          fetchedAt: pageResult.fetchedAt,
        },
        { status: 422 }
      );
    }

    // Extract job data using OpenAI
    const extraction = await extractJob(pageResult.text, pageResult.title, pageResult.finalUrl);

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
