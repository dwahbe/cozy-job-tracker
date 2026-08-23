import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { fetchPage } from '@/lib/fetchPage';
import { extractJob } from '@/lib/extractJob';
import { validateExtraction } from '@/lib/validateExtraction';

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
    const pageResult = await fetchPage(url);

    if (pageResult.fetchError && pageResult.text.length === 0) {
      return NextResponse.json(
        { error: pageResult.fetchError, errorType: pageResult.errorType },
        { status: 422 }
      );
    }

    const extraction = await extractJob(
      pageResult.text,
      pageResult.title,
      pageResult.finalUrl,
      pageResult.structured
    );

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
    console.error('Extension parse-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse job' },
      { status: 500 }
    );
  }
}
