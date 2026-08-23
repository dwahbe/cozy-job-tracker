import { NextRequest, NextResponse } from 'next/server';
import { createJobFromValidation } from '@/lib/kv';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { MAX_BULK_JOBS } from '@/lib/limits';
import { ok } from '@/lib/outcome';
import type { ValidatedJob } from '@/lib/validateExtraction';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { jobs } = (body ?? {}) as { jobs?: ValidatedJob[] };

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 });
    }
    if (jobs.length > MAX_BULK_JOBS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BULK_JOBS} jobs at a time` },
        { status: 400 }
      );
    }
    if (jobs.some((job) => !job || typeof job !== 'object' || !job.finalUrl)) {
      return NextResponse.json({ error: 'Each job must have a URL' }, { status: 400 });
    }

    const result = await withBoard(userId, (board) => {
      const newJobs = jobs.map((job) => createJobFromValidation(job, board.columns));
      board.jobs.push(...newJobs);
      return ok(newJobs.length);
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true, added: result.value });
  } catch (error) {
    console.error('Bulk add jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add jobs' },
      { status: 500 }
    );
  }
}
