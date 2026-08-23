import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { createJobFromValidation } from '@/lib/kv';
import type { ValidatedJob } from '@/lib/validateExtraction';
import { fetchPage } from '@/lib/fetchPage';
import { extractJob } from '@/lib/extractJob';
import { validateExtraction } from '@/lib/validateExtraction';
import { outcomeError, unauthorized, withBoard } from '@/lib/api-auth';
import { addManualJob, applyJobUpdates, updatesFromObject } from '@/lib/job-updates';
import { limited } from '@/lib/ratelimit';
import { ok } from '@/lib/outcome';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) return unauthorized();

    const body = await req.json().catch(() => null);
    const { job, url, manual, overrides, customFields } = (body ?? {}) as {
      job?: ValidatedJob;
      url?: string;
      manual?: unknown;
      overrides?: Partial<{
        title: string;
        company: string;
        location: string;
        employmentType: string;
        notes: string;
        dueDate: string;
      }>;
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

    // Path 2: Legacy URL parse (extension v1.0)
    // TODO: remove v1.0 compat once extension v1.1+ is widespread
    const isLegacy = !job && typeof url === 'string';

    let validatedJob: ValidatedJob;
    let fetchWarning: string | undefined;

    if (isLegacy) {
      const blocked = await limited('parse', user.userId);
      if (blocked) return blocked;

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
      validatedJob = validateExtraction(
        extraction,
        pageResult.text,
        pageResult.fetchedAt,
        pageResult.finalUrl
      );
      fetchWarning = pageResult.fetchError;
    } else if (job?.finalUrl) {
      // Path 3: Pre-parsed job (extension v1.1+)
      validatedJob = job;
    } else {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }

    const result = await withBoard(user.userId, (board) => {
      const newJob = createJobFromValidation(validatedJob, board.columns);
      board.jobs.push(newJob);

      // Edits the user made in the extension's preview, validated like any other update.
      const updates = updatesFromObject(
        overrides && typeof overrides === 'object' ? overrides : undefined,
        customFields && typeof customFields === 'object' ? customFields : undefined
      ).filter(({ field, value }) => {
        if (typeof value !== 'string') return false;
        // Blank title/company overrides mean "keep what was parsed".
        return !((field === 'title' || field === 'company') && !value.trim());
      });
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
      ...(fetchWarning ? { warning: fetchWarning } : {}),
    });
  } catch (error) {
    console.error('Extension add-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add job' },
      { status: 500 }
    );
  }
}
