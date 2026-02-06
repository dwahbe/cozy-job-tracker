import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getBoard, saveBoard, generateJobId, type Job } from '@/lib/kv';
import type { ValidatedJob } from '@/lib/validateExtraction';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;
const MAX_JOBS = 50;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, jobs } = body as {
      slug: string;
      jobs: ValidatedJob[];
    };

    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board slug' }, { status: 400 });
    }

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

    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Create all jobs in one pass
    const newJobs: Job[] = jobs.map((job) => {
      // Build custom fields with defaults
      const customFields: Record<string, string> = {};
      for (const col of board.columns) {
        customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
      }

      return {
        id: generateJobId(),
        title: job.title || 'Unknown Position',
        company: job.company || 'Unknown Company',
        link: job.finalUrl,
        location: job.location || 'Not listed',
        employmentType: job.employment_type || 'Not listed',
        notes: job.notes || '',
        status: 'Saved',
        dueDate: job.due_date || '',
        parsedOn: job.fetchedAt?.split('T')[0] || today,
        verified: job.isVerified ? 'Yes' : 'No',
        customFields,
      };
    });

    board.jobs.push(...newJobs);
    await saveBoard(slug, board);
    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true, added: newJobs.length });
  } catch (error) {
    console.error('Bulk add jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add jobs' },
      { status: 500 }
    );
  }
}
