import { NextRequest, NextResponse } from 'next/server';
import { createJobFromValidation } from '@/lib/kv';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { addManualJob } from '@/lib/job-updates';
import { ok } from '@/lib/outcome';
import type { ValidatedJob } from '@/lib/validateExtraction';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { job, manualJob } = (body ?? {}) as { job?: ValidatedJob; manualJob?: unknown };

    if (!job && !manualJob) {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }
    // URL-parsed jobs come from our own extractor and must carry the page they were parsed from.
    if (job && !job.finalUrl) {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }

    const result = await withBoard(userId, (board) => {
      if (manualJob) return addManualJob(board, manualJob, 'Manual');
      const newJob = createJobFromValidation(job!, board.columns);
      board.jobs.push(newJob);
      return ok(newJob);
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true, jobId: result.value.id });
  } catch (error) {
    console.error('Add job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add job' },
      { status: 500 }
    );
  }
}
