import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBoardByUserId, saveBoardByUserId } from '@/lib/kv';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title } = await request.json();
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const board = await getBoardByUserId(session.user.id);
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  board.title = title.trim();
  await saveBoardByUserId(session.user.id, board);

  return NextResponse.json({ ok: true });
}
