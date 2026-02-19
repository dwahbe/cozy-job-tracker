import { NextRequest, NextResponse } from 'next/server';
import { createJobFromValidation } from '@/lib/kv';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';
import type { ValidatedJob } from '@/lib/validateExtraction';

export const runtime = 'nodejs';

const MAX_JOBS = 50;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, jobs } = body as {
      slug: string;
      jobs: ValidatedJob[];
    };

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 });
    }

    if (jobs.length > MAX_JOBS) {
      return NextResponse.json({ error: `Maximum ${MAX_JOBS} jobs at a time` }, { status: 400 });
    }

    // Validate each job has a finalUrl
    for (const job of jobs) {
      if (!job.finalUrl) {
        return NextResponse.json({ error: 'Each job must have a URL' }, { status: 400 });
      }
    }

    // Resolve board (auth session or legacy slug)
    const ctx = await resolveBoard(slug);
    if (!ctx) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const newJobs = jobs.map((job) => createJobFromValidation(job, ctx.board.columns));

    ctx.board.jobs.push(...newJobs);
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true, added: newJobs.length });
  } catch (error) {
    console.error('Bulk add jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add jobs' },
      { status: 500 }
    );
  }
}
