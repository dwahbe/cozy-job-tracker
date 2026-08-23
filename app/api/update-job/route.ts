import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized, withBoard } from '@/lib/api-auth';
import { applyJobUpdates } from '@/lib/job-updates';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { jobId, field, value, fields } = (body ?? {}) as {
      jobId?: unknown;
      field?: unknown;
      value?: unknown;
      fields?: unknown;
    };
    if (typeof jobId !== 'string' || !jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Accept a single { field, value } or a batch `fields` array; validation lives in applyJobUpdates.
    const updates = fields ?? (field !== undefined ? [{ field, value: value ?? '' }] : []);

    const result = await withBoard(userId, (board) => applyJobUpdates(board, jobId, updates));
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update job' },
      { status: 500 }
    );
  }
}
