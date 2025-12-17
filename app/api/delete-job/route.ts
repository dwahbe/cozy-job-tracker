import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import { parseBoardFile, deleteJobFromMarkdown, reconstructFile } from '@/lib/markdown';

export const runtime = 'nodejs';

const BOARDS_DIR = path.join(process.cwd(), 'content', 'boards');
const SLUG_REGEX = /^[a-z0-9-]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, jobLink } = body as { slug: string; jobLink: string };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid board slug' },
        { status: 400 }
      );
    }

    // Validate jobLink
    if (!jobLink) {
      return NextResponse.json(
        { error: 'jobLink is required' },
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

    // Delete the job from markdown
    const updatedContent = deleteJobFromMarkdown(boardData.content, jobLink);

    // Reconstruct file with frontmatter
    const newFileContent = reconstructFile(boardData, updatedContent);

    // Write back to file
    await fs.writeFile(boardPath, newFileContent, 'utf-8');

    // Revalidate the board page
    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete job' },
      { status: 500 }
    );
  }
}

