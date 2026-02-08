import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { getBoard, getBoardByUserId, saveBoardByUserId, markBoardMigrated } from '@/lib/kv';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Must be authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug, pin } = await request.json();
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  // Get the legacy board
  const legacyBoard = await getBoard(slug);
  if (!legacyBoard) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  // If already migrated
  if (legacyBoard.migratedTo) {
    return NextResponse.json({ error: 'Board already migrated' }, { status: 409 });
  }

  // If PIN-protected, verify the PIN
  if (legacyBoard.pin) {
    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'This board is PIN-protected. Please enter the PIN.' },
        { status: 403 }
      );
    }

    const pinValid = await bcrypt.compare(pin, legacyBoard.pin);
    if (!pinValid) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 403 });
    }
  }

  const userId = session.user.id;

  // Check if user already has a board
  const existingBoard = await getBoardByUserId(userId);

  if (existingBoard) {
    // Merge: append legacy jobs to existing board
    existingBoard.jobs = [...existingBoard.jobs, ...legacyBoard.jobs];
    // Merge custom columns (add new ones only)
    const existingColumnNames = new Set(existingBoard.columns.map((c) => c.name));
    for (const col of legacyBoard.columns) {
      if (!existingColumnNames.has(col.name)) {
        existingBoard.columns.push(col);
      }
    }
    await saveBoardByUserId(userId, existingBoard);
  } else {
    // First claim: copy the legacy board as-is (without PIN)
    const { pin: _pin, migratedTo: _migratedTo, migratedAt: _migratedAt, ...boardData } = legacyBoard;
    await saveBoardByUserId(userId, boardData);
  }

  // Mark the legacy board as migrated
  await markBoardMigrated(slug, userId);

  return NextResponse.json({ ok: true, redirect: '/board' });
}
