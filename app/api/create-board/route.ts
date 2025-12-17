import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const BOARDS_DIR = path.join(process.cwd(), 'content', 'boards');
const SLUG_REGEX = /^[a-z0-9-]+$/;
const PIN_REGEX = /^\d{4,6}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, title, pin } = body as { slug: string; title?: string; pin?: string };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid slug. Use only lowercase letters, numbers, and hyphens.' },
        { status: 400 }
      );
    }

    // Validate PIN if provided
    if (pin && !PIN_REGEX.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be 4-6 digits.' },
        { status: 400 }
      );
    }

    // Build safe path and verify it's within BOARDS_DIR
    const boardPath = path.join(BOARDS_DIR, `${slug}.md`);
    const resolvedPath = path.resolve(boardPath);
    if (!resolvedPath.startsWith(path.resolve(BOARDS_DIR))) {
      return NextResponse.json(
        { error: 'Invalid board path' },
        { status: 400 }
      );
    }

    // Ensure boards directory exists
    await fs.mkdir(BOARDS_DIR, { recursive: true });

    // Check if board already exists
    try {
      await fs.access(boardPath);
      return NextResponse.json(
        { error: 'A board with this name already exists' },
        { status: 409 }
      );
    } catch {
      // Board doesn't exist, we can create it
    }

    // Create the board file
    const boardTitle = title || `${slug.charAt(0).toUpperCase() + slug.slice(1)}'s Job Board`;
    
    // Hash PIN if provided
    const pinLine = pin ? `\npin: ${await bcrypt.hash(pin, 10)}` : '';
    
    const content = `---
title: ${boardTitle}${pinLine}
columns: []
---

# ${boardTitle}

Personal job tracking board.

## Saved
`;

    await fs.writeFile(boardPath, content, 'utf-8');

    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error('Create board error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create board' },
      { status: 500 }
    );
  }
}

