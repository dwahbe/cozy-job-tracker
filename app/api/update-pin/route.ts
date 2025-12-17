import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getBoard, saveBoard } from '@/lib/kv';

export const runtime = 'nodejs';

const SLUG_REGEX = /^[a-z0-9-]+$/;
const PIN_REGEX = /^\d{4,6}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, currentPin, newPin } = body as {
      slug: string;
      currentPin?: string;
      newPin?: string | null;
    };

    // Validate slug
    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: 'Invalid board' }, { status: 400 });
    }

    // Validate new PIN format if provided
    if (newPin && !PIN_REGEX.test(newPin)) {
      return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
    }

    // Get board from KV
    const board = await getBoard(slug);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // If board has existing PIN, verify current PIN
    if (board.pin) {
      if (!currentPin) {
        return NextResponse.json({ error: 'Current PIN required' }, { status: 400 });
      }

      const isValid = await bcrypt.compare(currentPin, board.pin);
      if (!isValid) {
        return NextResponse.json({ error: 'Incorrect current PIN' }, { status: 401 });
      }
    }

    // Update PIN
    if (newPin) {
      // Set or change PIN
      board.pin = await bcrypt.hash(newPin, 10);
    } else {
      // Remove PIN
      delete board.pin;
    }

    // Save board
    await saveBoard(slug, board);

    // Create response and clear auth cookie (user needs to re-authenticate)
    const response = NextResponse.json({ success: true });

    // Clear the auth cookie
    response.cookies.set(`board_${slug}_auth`, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Update PIN error:', error);
    return NextResponse.json({ error: 'Failed to update PIN' }, { status: 500 });
  }
}
