import { NextRequest, NextResponse } from 'next/server';
import { resolveBoard, saveBoardAndRevalidate } from '@/lib/api-auth';

export const runtime = 'nodejs';

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

interface FieldUpdate {
  field: string;
  value: string;
}

function applyFieldToJob(
  job: {
    title: string;
    company: string;
    link: string;
    notes: string;
    dueDate: string;
    location: string;
    employmentType: string;
    status: string;
    customFields: Record<string, string>;
  },
  field: string,
  value: string
) {
  const fieldLower = field.toLowerCase();
  if (fieldLower === 'status') job.status = value;
  else if (fieldLower === 'title') job.title = value;
  else if (fieldLower === 'company') job.company = value;
  else if (fieldLower === 'link') job.link = value;
  else if (fieldLower === 'notes') job.notes = value;
  else if (fieldLower === 'due date') job.dueDate = value;
  else if (fieldLower === 'location') job.location = value;
  else if (fieldLower === 'employment type') job.employmentType = value;
  else job.customFields[field] = value;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, field, value, fields } = body as {
      jobId?: string;
      field?: string;
      value?: string;
      fields?: FieldUpdate[];
    };

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Normalize: support single field or batch fields array
    const updates: FieldUpdate[] = fields ? fields : field ? [{ field, value: value ?? '' }] : [];

    if (updates.length === 0) {
      return NextResponse.json({ error: 'field or fields is required' }, { status: 400 });
    }

    // Resolve the signed-in user's board
    const ctx = await resolveBoard();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate all updates
    for (const update of updates) {
      if (update.field === 'Status' && !STATUS_OPTIONS.includes(update.value)) {
        return NextResponse.json(
          { error: `Status must be one of: ${STATUS_OPTIONS.join(', ')}` },
          { status: 400 }
        );
      }
      if (update.field === 'Applied' && !['Yes', 'No'].includes(update.value)) {
        return NextResponse.json({ error: 'Applied must be Yes or No' }, { status: 400 });
      }
      const customColumn = ctx.board.columns.find(
        (c) => c.name.toLowerCase() === update.field.toLowerCase() && c.type === 'dropdown'
      );
      if (customColumn && customColumn.options && !customColumn.options.includes(update.value)) {
        return NextResponse.json(
          { error: `${update.field} must be one of: ${customColumn.options.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Find the job by id
    const jobIndex = ctx.board.jobs.findIndex((j) => j.id === jobId);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Apply all field updates in a single read-modify-write
    const job = ctx.board.jobs[jobIndex];
    for (const update of updates) {
      applyFieldToJob(job, update.field, update.value);
    }

    // Save board once
    await saveBoardAndRevalidate(ctx);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update job' },
      { status: 500 }
    );
  }
}
