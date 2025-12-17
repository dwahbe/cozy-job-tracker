import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import { parseBoardFile, updateJobInMarkdown, reconstructFile } from '@/lib/markdown';

export const runtime = 'nodejs';

const BOARDS_DIR = path.join(process.cwd(), 'content', 'boards');
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
      return NextResponse.json(
        { error: 'Invalid board slug' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!jobLink || !field) {
      return NextResponse.json(
        { error: 'jobLink and field are required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Applied must be Yes or No' },
        { status: 400 }
      );
    }

    // Build safe path
    const boardPath = path.join(BOARDS_DIR, `${slug}.md`);
    const resolvedPath = path.resolve(boardPath);
    if (!resolvedPath.startsWith(path.resolve(BOARDS_DIR))) {
      return NextResponse.json(
        { error: 'Invalid board path' },
        { status: 400 }
      );
    }

    // Check if board exists
    try {
      await fs.access(boardPath);
    } catch {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // Read current board content
    const fileContent = await fs.readFile(boardPath, 'utf-8');
    const boardData = parseBoardFile(fileContent);

    // For dropdown custom columns, validate the value
    const customColumn = boardData.columns.find(
      c => c.name.toLowerCase() === field.toLowerCase() && c.type === 'dropdown'
    );
    if (customColumn && customColumn.options && !customColumn.options.includes(value)) {
      return NextResponse.json(
        { error: `${field} must be one of: ${customColumn.options.join(', ')}` },
        { status: 400 }
      );
    }

    // Update the job in markdown
    const updatedContent = updateJobInMarkdown(boardData.content, jobLink, field, value);

    // Reconstruct file with frontmatter
    const newFileContent = reconstructFile(boardData, updatedContent);

    // Write back to file
    await fs.writeFile(boardPath, newFileContent, 'utf-8');

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

