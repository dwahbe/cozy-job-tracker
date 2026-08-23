import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { boardKey, getOrCreateBoard, type Board } from '@/lib/kv';
import { casSet } from '@/lib/cas';
import { fail, type Outcome } from '@/lib/outcome';
import { scheduleRevalidate } from '@/lib/revalidate';

const MAX_ATTEMPTS = 4; // one try plus three retries after a version conflict
const BOARD_PATHS = ['/board', '/board/trash'];

/** The signed-in user's id, or null when there is no session (callers answer 401). */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** JSON error response for a rejected mutation. */
export function outcomeError(outcome: { status: number; error: string }): NextResponse {
  return NextResponse.json({ error: outcome.error }, { status: outcome.status });
}

/**
 * Read → mutate → compare-and-set write for the user's board.
 *
 * `mutate` runs against a freshly read board and returns ok(value) to save, unchanged() to skip
 * the write, or fail(status, error) to reject (nothing is written). If another writer got in
 * first the board is re-read and the mutator re-run, up to MAX_ATTEMPTS. The board pages are
 * revalidated after the response unless `revalidate` is false (pages that already render the
 * fresh data).
 */
export async function withBoard<T>(
  userId: string,
  mutate: (board: Board) => Outcome<T> | Promise<Outcome<T>>,
  options: { revalidate?: boolean } = {}
): Promise<Outcome<T>> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = await getOrCreateBoard(userId);
    const expected = board.version ?? 0;

    const outcome = await mutate(board);
    if (!outcome.ok || !outcome.changed) return outcome;

    const saved = await casSet(boardKey(userId), expected, { ...board, version: expected + 1 });
    if (saved) {
      if (options.revalidate !== false) scheduleRevalidate(BOARD_PATHS);
      return outcome;
    }
  }
  return fail(409, 'Your board changed while saving — please try again.');
}
