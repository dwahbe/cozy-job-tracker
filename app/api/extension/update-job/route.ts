import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';
import { getOrCreateBoard, saveBoardByUserId } from '@/lib/kv';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

interface UpdateFields {
  title?: string;
  company?: string;
  link?: string;
  location?: string;
  employmentType?: string;
  notes?: string;
  status?: string;
  dueDate?: string;
  customFields?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const user = await validateExtensionToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, fields } = body as { jobId?: string; fields?: UpdateFields };

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }
    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'fields is required' }, { status: 400 });
    }

    const board = await getOrCreateBoard(user.userId);

    const job = board.jobs.find((j) => j.id === jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (fields.status && !STATUS_OPTIONS.includes(fields.status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${STATUS_OPTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    if (fields.title !== undefined) job.title = fields.title;
    if (fields.company !== undefined) job.company = fields.company;
    if (fields.link !== undefined) job.link = fields.link;
    if (fields.location !== undefined) job.location = fields.location;
    if (fields.employmentType !== undefined) job.employmentType = fields.employmentType;
    if (fields.notes !== undefined) job.notes = fields.notes;
    if (fields.status !== undefined) job.status = fields.status;
    if (fields.dueDate !== undefined) job.dueDate = fields.dueDate;
    if (fields.customFields) {
      for (const [key, value] of Object.entries(fields.customFields)) {
        job.customFields[key] = value;
      }
    }

    await saveBoardByUserId(user.userId, board);
    revalidatePath('/board');

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Extension update-job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update job' },
      { status: 500 }
    );
  }
}
