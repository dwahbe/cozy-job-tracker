import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getBoard, saveBoard } from '@/lib/kv';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;
const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, jobLink, field, value } = body as {
      slug: string;
      jobLink: string;
      field: string;
      value: string;
    };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board slug' }, { status: 400 });
    }

    // Validate required fields
    if (!jobLink || !field) {
      return NextResponse.json({ error: 'jobLink and field are required' }, { status: 400 });
    }

    // Validate Status field values
    if (field === 'Status' && !STATUS_OPTIONS.includes(value)) {
      return NextResponse.json(
        { error: `Status must be one of: ${STATUS_OPTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate Applied field values
    if (field === 'Applied' && !['Yes', 'No'].includes(value)) {
      return NextResponse.json({ error: 'Applied must be Yes or No' }, { status: 400 });
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // For dropdown custom columns, validate the value
    const customColumn = board.columns.find(
      (c) => c.name.toLowerCase() === field.toLowerCase() && c.type === 'dropdown'
    );
    if (customColumn && customColumn.options && !customColumn.options.includes(value)) {
      return NextResponse.json(
        { error: `${field} must be one of: ${customColumn.options.join(', ')}` },
        { status: 400 }
      );
    }

    // Find and update the job
    const jobIndex = board.jobs.findIndex((j) => j.link === jobLink);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Update the appropriate field
    const job = board.jobs[jobIndex];
    const fieldLower = field.toLowerCase();

    // Check if it's a built-in field
    if (fieldLower === 'status') {
      job.status = value;
    } else if (fieldLower === 'title') {
      job.title = value;
    } else if (fieldLower === 'company') {
      job.company = value;
    } else if (fieldLower === 'link') {
      job.link = value;
    } else if (fieldLower === 'notes') {
      job.notes = value;
    } else if (fieldLower === 'due date') {
      job.dueDate = value;
    } else if (fieldLower === 'location') {
      job.location = value;
    } else if (fieldLower === 'employment type') {
      job.employmentType = value;
    } else {
      // Custom field
      job.customFields[field] = value;
    }

    // Save board
    await saveBoard(slug, board);

    // Revalidate the board page
    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update job' },
      { status: 500 }
    );
  }
}
