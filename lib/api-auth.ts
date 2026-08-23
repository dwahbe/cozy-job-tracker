import { auth } from '@/auth';
import { getOrCreateBoard, saveBoardByUserId, type Board } from '@/lib/kv';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

export interface BoardContext {
  board: Board;
  userId: string;
}

/**
 * Resolve the signed-in user's board for an API request (created on first use).
 * Returns null only when there is no session — callers should answer 401.
 */
export async function resolveBoard(): Promise<BoardContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const board = await getOrCreateBoard(session.user.id);
  return { board, userId: session.user.id };
}

/**
 * Save the board and revalidate the board pages (deferred until after the response).
 */
export async function saveBoardAndRevalidate(ctx: BoardContext): Promise<void> {
  await saveBoardByUserId(ctx.userId, ctx.board);
  after(() => {
    revalidatePath('/board');
    revalidatePath('/board/trash');
  });
}
