import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import {
  getBoardByUserId,
  saveBoardByUserId,
  createJobFromValidation,
  generateJobId,
} from '@/lib/kv';
import type { Job } from '@/lib/kv';
import type { ValidatedJob } from '@/lib/validateExtraction';
import { fetchPage } from '@/lib/fetchPage';
import { extractJob } from '@/lib/extractJob';
import { validateExtraction } from '@/lib/validateExtraction';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

interface ManualJob {
  title: string;
  company: string;
  link?: string;
  location?: string;
  employmentType?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { job, url, manual, overrides, customFields } = body as {
      job?: ValidatedJob;
      url?: string;
      manual?: ManualJob;
      overrides?: Partial<{
        title: string;
        company: string;
        location: string;
        employmentType: string;
        notes: string;
        dueDate: string;
      }>;
      customFields?: Record<string, string>;
    };

    const board = await getBoardByUserId(user.userId);
    if (!board) {
      return NextResponse.json(
        { error: 'Board not found. Create a board on cozyjobtracker.com first.' },
        { status: 404 }
      );
    }

    // Path 1: Manual job (MCP / direct field entry)
    if (manual && manual.title && manual.company) {
      const customFields: Record<string, string> = {};
      for (const col of board.columns) {
        customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
      }

      const newJob: Job = {
        id: generateJobId(),
        title: manual.title,
        company: manual.company,
        link: manual.link || '',
        location: manual.location || 'Not listed',
        employmentType: manual.employmentType || 'Not listed',
        notes: manual.notes || '',
        status: 'Saved',
        dueDate: '',
        parsedOn: new Date().toISOString().split('T')[0],
        verified: 'No',
        customFields,
      };

      board.jobs.push(newJob);
      await saveBoardByUserId(user.userId, board);
      revalidatePath('/board');

      return NextResponse.json({
        success: true,
        title: newJob.title,
        company: newJob.company,
      });
    }

    // Path 2: Legacy URL parse (extension v1.0)
    // TODO: remove v1.0 compat once extension v1.1+ is widespread
    const isLegacy = !job && typeof url === 'string';

    let validatedJob: ValidatedJob;
    let fetchWarning: string | undefined;

    if (isLegacy) {
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

    const newJob = createJobFromValidation(validatedJob, board.columns);

    if (overrides) {
      if (typeof overrides.title === 'string' && overrides.title.trim())
        newJob.title = overrides.title.trim();
      if (typeof overrides.company === 'string' && overrides.company.trim())
        newJob.company = overrides.company.trim();
      if (typeof overrides.location === 'string') newJob.location = overrides.location.trim();
      if (typeof overrides.employmentType === 'string')
        newJob.employmentType = overrides.employmentType.trim();
      if (typeof overrides.notes === 'string') newJob.notes = overrides.notes;
      if (typeof overrides.dueDate === 'string') newJob.dueDate = overrides.dueDate.trim();
    }

    if (customFields) {
      const allowed = new Set(board.columns.map((c) => c.name));
      for (const [name, value] of Object.entries(customFields)) {
        if (allowed.has(name) && typeof value === 'string') {
          newJob.customFields[name] = value;
        }
      }
    }

    board.jobs.push(newJob);
    await saveBoardByUserId(user.userId, board);
    revalidatePath('/board');

    return NextResponse.json({
      success: true,
      title: newJob.title,
      company: newJob.company,
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
