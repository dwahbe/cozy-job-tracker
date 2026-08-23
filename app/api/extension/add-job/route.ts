import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { createJobFromValidation } from '@/lib/kv';
import type { ValidatedJob } from '@/lib/validateExtraction';
import { outcomeError, unauthorized, withBoard } from '@/lib/api-auth';
import { addManualJob, applyJobUpdates, findColumn, isDueDateValue } from '@/lib/job-updates';
import type { FieldUpdate } from '@/lib/job-updates';
import { ok } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    const { job, manual, overrides, customFields } = (body ?? {}) as {
      job?: ValidatedJob;
      manual?: unknown;
      overrides?: Record<string, unknown>;
      customFields?: Record<string, unknown>;
    };

    // Path 1: Manual job (direct field entry)
    if (manual && typeof manual === 'object') {
      const result = await withBoard(user.userId, (board) => addManualJob(board, manual, 'No'));
      if (!result.ok) return outcomeError(result);
      return NextResponse.json({
        success: true,
        title: result.value.title,
        company: result.value.company,
      });
    }

    // Pre-parsed job from the extension (v1.1+): the extension calls /api/extension/parse-job
    // first, lets the user review the fields, then posts the result here.
    if (!job?.finalUrl) {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }
    const validatedJob = job;

    const result = await withBoard(user.userId, (board) => {
      const newJob = createJobFromValidation(validatedJob, board.columns);
      board.jobs.push(newJob);

      // Edits the user made in the extension's preview, validated like any other update — with
      // two allowances for values the extension echoes back untouched: a parsed due date that
      // isn't a real date ("Open until filled") keeps the parsed text rather than failing the
      // save, and a custom column deleted since the popup loaded is skipped.
      const updates: FieldUpdate[] = [];
      for (const [field, value] of Object.entries(
        overrides && typeof overrides === 'object' ? overrides : {}
      )) {
        if (typeof value !== 'string') continue;
        // Blank title/company overrides mean "keep what was parsed".
        if ((field === 'title' || field === 'company') && !value.trim()) continue;
        if (field === 'dueDate' && !isDueDateValue(value)) continue;
        updates.push({ field, value });
      }
      for (const [field, value] of Object.entries(
        customFields && typeof customFields === 'object' ? customFields : {}
      )) {
        if (typeof value !== 'string' || !findColumn(board.columns, field)) continue;
        updates.push({ field, value });
      }
      if (updates.length === 0) return ok(newJob);

      const applied = applyJobUpdates(board, newJob.id, updates);
      if (!applied.ok) {
        board.jobs.pop();
        return applied;
      }
      return ok(newJob);
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json({
      success: true,
      title: result.value.title,
      company: result.value.company,
    });
  } catch (error) {
    console.error('Extension add-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add job' },
      { status: 500 }
    );
  }
}
