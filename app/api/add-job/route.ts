import { NextRequest, NextResponse } from 'next/server';
import { generateJobId, type Job } from '@/lib/kv';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';
import type { ValidatedJob } from '@/lib/validateExtraction';

export const runtime = 'nodejs';

interface ManualJob {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  link: string;
  notes: string;
  customFields?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, job, manualJob } = body as {
      slug: string;
      job?: ValidatedJob;
      manualJob?: ManualJob;
    };

    // Validate that we have either job or manualJob
    if (!job && !manualJob) {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }

    // For URL-parsed jobs, require finalUrl
    if (job && !job.finalUrl) {
      return NextResponse.json({ error: 'Invalid job data' }, { status: 400 });
    }

    // For manual jobs, require title and company
    if (manualJob && (!manualJob.title || !manualJob.company)) {
      return NextResponse.json({ error: 'Title and company are required' }, { status: 400 });
    }

    // Resolve board (auth session or legacy slug)
    const ctx = await resolveBoard(slug);
    if (!ctx) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Build custom fields with defaults, merging any provided values
    const customFields: Record<string, string> = {};
    for (const col of ctx.board.columns) {
      const defaultValue = col.type === 'checkbox' ? 'No' : '';
      const providedValue = manualJob?.customFields?.[col.name];
      customFields[col.name] = providedValue ?? defaultValue;
    }

    const today = new Date().toISOString().split('T')[0];

    // Create the new job
    const newJob: Job = manualJob
      ? {
          id: generateJobId(),
          title: manualJob.title,
          company: manualJob.company,
          link: manualJob.link || '',
          location: manualJob.location || 'Not listed',
          employmentType: manualJob.employmentType || 'Not listed',
          notes: manualJob.notes || '',
          status: 'Saved',
          dueDate: '',
          parsedOn: today,
          verified: 'Manual',
          customFields,
        }
      : {
          id: generateJobId(),
          title: job!.title || 'Unknown Position',
          company: job!.company || 'Unknown Company',
          link: job!.finalUrl,
          location: job!.location || 'Not listed',
          employmentType: job!.employment_type || 'Not listed',
          notes: job!.notes || '',
          status: 'Saved',
          dueDate: job!.due_date || '',
          parsedOn: job!.fetchedAt.split('T')[0],
          verified: job!.isVerified ? 'Yes' : 'No',
          customFields,
        };

    // Add job to board
    ctx.board.jobs.push(newJob);

    // Save board
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add job' },
      { status: 500 }
    );
  }
}
