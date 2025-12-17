import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getBoard } from '@/lib/kv';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, pin } = body as { slug: string; pin: string };

    // Validate inputs
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board' }, { status: 400 });
    }

    if (!pin) {
      return NextResponse.json({ error: 'PIN required' }, { status: 400 });
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    if (!board.pin) {
      return NextResponse.json({ error: 'Board is not protected' }, { status: 400 });
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, board.pin);

    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }

    // Create response with auth cookie
    const response = NextResponse.json({ success: true });

    // Set HttpOnly cookie for this board
    response.cookies.set(`board_${slug}_auth`, 'verified', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Verify PIN error:', error);
    return NextResponse.json({ error: 'Failed to verify PIN' }, { status: 500 });
  }
}
