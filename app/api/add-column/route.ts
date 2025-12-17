import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import { addColumnToFrontmatter, type Column } from '@/lib/markdown';

export const runtime = 'nodejs';

const BOARDS_DIR = path.join(process.cwd(), 'content', 'boards');
const SLUG_REGEX = /^[a-z0-9-]+$/;
const VALID_COLUMN_TYPES = ['text', 'checkbox', 'dropdown'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, column } = body as { slug: string; column: Column };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid board slug' },
        { status: 400 }
      );
    }

    // Validate column
    if (!column || !column.name || !column.type) {
      return NextResponse.json(
        { error: 'Column name and type are required' },
        { status: 400 }
      );
    }

    if (!VALID_COLUMN_TYPES.includes(column.type)) {
      return NextResponse.json(
        { error: `Column type must be one of: ${VALID_COLUMN_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Dropdown columns need options
    if (column.type === 'dropdown' && (!column.options || column.options.length === 0)) {
      return NextResponse.json(
        { error: 'Dropdown columns require at least one option' },
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

    // Add column to frontmatter
    const newFileContent = addColumnToFrontmatter(fileContent, column);

    // Write back to file
    await fs.writeFile(boardPath, newFileContent, 'utf-8');

    // Revalidate the board page
    revalidatePath(`/b/${slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add column error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add column' },
      { status: 500 }
    );
  }
}

