import { auth } from '@/auth';
import { getBoard, saveBoard, getBoardByUserId, saveBoardByUserId, type Board } from '@/lib/kv';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

const SLUG_REGEX = /^[a-z0-9-]+$/;

export interface BoardContext {
  board: Board;
  key: string;
  isAuth: boolean;
}

/**
 * Resolve the board for an API request.
 * Checks auth session first (userId). Falls back to slug from request body.
 * Returns the board, the key used, and whether this is an authenticated request.
 */
export async function resolveBoard(slug: string | undefined): Promise<BoardContext | null> {
  const session = await auth();

  // Authenticated: use userId
  if (session?.user?.id) {
    const board = await getBoardByUserId(session.user.id);
    if (!board) return null;
    return { board, key: session.user.id, isAuth: true };
  }

  // Legacy: use slug
  if (!slug || !SLUG_REGEX.test(slug)) return null;
  const board = await getBoard(slug);
  if (!board) return null;
  return { board, key: slug, isAuth: false };
}

/**
 * Save a board and revalidate the correct path.
 */
export async function saveBoardAndRevalidate(ctx: BoardContext): Promise<void> {
  if (ctx.isAuth) {
    await saveBoardByUserId(ctx.key, ctx.board);
    after(() => {
      revalidatePath('/board');
      revalidatePath('/trash');
    });
  } else {
    await saveBoard(ctx.key, ctx.board);
    after(() => {
      revalidatePath(`/b/${ctx.key}`);
    });
  }
}

/**
 * Validate a slug for legacy requests only.
 * Returns true if the user is authenticated (skip slug validation) or if the slug is valid.
 */
export async function isValidSlugOrAuth(slug: string | undefined): Promise<boolean> {
  const session = await auth();
  if (session?.user?.id) return true;
  return !!slug && SLUG_REGEX.test(slug);
}
