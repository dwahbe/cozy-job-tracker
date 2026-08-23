import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { outcomeError, unauthorized, withBoard } from '@/lib/api-auth';
import { applyJobUpdates, updatesFromObject } from '@/lib/job-updates';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    const { jobId, fields } = (body ?? {}) as { jobId?: unknown; fields?: unknown };

    if (typeof jobId !== 'string' || !jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields is required' }, { status: 400 });
    }

    // { title?, company?, …, customFields? } → validated field updates (unknown columns are rejected).
    const { customFields, ...standard } = fields as Record<string, unknown>;
    const updates = updatesFromObject(
      standard,
      customFields && typeof customFields === 'object' && !Array.isArray(customFields)
        ? (customFields as Record<string, unknown>)
        : undefined
    );

    const result = await withBoard(user.userId, (board) => applyJobUpdates(board, jobId, updates));
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({ success: true, job: result.value });
  } catch (error) {
    console.error('Extension update-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update job' },
      { status: 500 }
    );
  }
}
