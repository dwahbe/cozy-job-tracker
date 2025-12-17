import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { saveBoard, boardExists, type Board } from '@/lib/kv';

export const runtime = 'nodejs';

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
      return NextResponse.json({ error: 'PIN must be 4-6 digits.' }, { status: 400 });
    }

    // Check if board already exists
    if (await boardExists(slug)) {
      return NextResponse.json({ error: 'A board with this name already exists' }, { status: 409 });
    }

    // Create the board
    const boardTitle = title || `${slug.charAt(0).toUpperCase() + slug.slice(1)}'s Job Board`;

    const board: Board = {
      title: boardTitle,
      columns: [],
      jobs: [],
    };

    // Hash PIN if provided
    if (pin) {
      board.pin = await bcrypt.hash(pin, 10);
    }

    await saveBoard(slug, board);

    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error('Create board error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create board' },
      { status: 500 }
    );
  }
}
