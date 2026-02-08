import { kv } from '@vercel/kv';
import type { Column } from './markdown';

/**
 * Board data structure for KV storage
 */
export interface Job {
  id: string;
  title: string;
  company: string;
  link: string;
  location: string;
  employmentType: string;
  notes: string;
  status: string;
  dueDate: string;
  parsedOn: string;
  verified: string;
  customFields: Record<string, string>;
}

export interface TrashedJob extends Job {
  deletedAt: string; // ISO date
}

export interface SortRule {
  field: string;
  direction: 'asc' | 'desc';
}

export interface Board {
  title: string;
  columns: Column[];
  columnOrder?: string[]; // Order of columns (built-in IDs + custom names)
  sortPreference?: SortRule[]; // Synced sort rules
  pin?: string; // bcrypt hash
  jobs: Job[];
  trash?: TrashedJob[]; // Soft-deleted jobs (auto-pruned after 30 days)
  // Migration fields (Phase 2)
  migratedTo?: string; // userId who claimed this board
  migratedAt?: string; // ISO date of migration
}

// Built-in column IDs
const BUILTIN_COLUMN_IDS = [
  '_title',
  '_company',
  '_location',
  '_type',
  '_dueDate',
  '_notes',
  '_status',
];

/**
 * Get the column order for a board, with defaults for boards without saved order
 */
export function getColumnOrder(board: Board): string[] {
  if (board.columnOrder && board.columnOrder.length > 0) {
    // Ensure any new custom columns are included
    const customNames = board.columns.map((c) => c.name);
    const missingCustom = customNames.filter((n) => !board.columnOrder!.includes(n));
    if (missingCustom.length > 0) {
      return [...board.columnOrder, ...missingCustom];
    }
    return board.columnOrder;
  }
  // Default: built-in columns followed by custom columns
  return [...BUILTIN_COLUMN_IDS, ...board.columns.map((c) => c.name)];
}

// Re-export Column type
export type { Column };

/**
 * Get a board by slug
 */
export async function getBoard(slug: string): Promise<Board | null> {
  return await kv.get<Board>(`board:${slug}`);
}

/**
 * Save a board
 */
export async function saveBoard(slug: string, board: Board): Promise<void> {
  await kv.set(`board:${slug}`, board);
}

/**
 * Check if a board exists
 */
export async function boardExists(slug: string): Promise<boolean> {
  const board = await kv.get(`board:${slug}`);
  return board !== null;
}

/**
 * List all board slugs
 */
export async function listBoards(): Promise<string[]> {
  const keys = await kv.keys('board:*');
  return keys.map((key) => key.replace('board:', ''));
}

/**
 * Delete a board
 */
export async function deleteBoard(slug: string): Promise<void> {
  await kv.del(`board:${slug}`);
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================
// Authenticated user board functions (userId-keyed)
// ============================================================

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Get a board by authenticated userId
 */
export async function getBoardByUserId(userId: string): Promise<Board | null> {
  return await kv.get<Board>(`board:${userId}`);
}

/**
 * Save a board for an authenticated user
 */
export async function saveBoardByUserId(userId: string, board: Board): Promise<void> {
  await kv.set(`board:${userId}`, board);
}

/**
 * List only legacy slug-based boards (excludes userId-keyed boards)
 */
export async function listLegacyBoards(): Promise<string[]> {
  const keys = await kv.keys('board:*');
  return keys.map((key) => key.replace('board:', '')).filter((id) => SLUG_PATTERN.test(id));
}

/**
 * List importable legacy boards (slug-based, not yet migrated) with titles and PIN status
 */
export async function listImportableBoards(): Promise<
  { slug: string; title: string; hasPin: boolean }[]
> {
  const slugs = await listLegacyBoards();
  const results: { slug: string; title: string; hasPin: boolean }[] = [];
  for (const slug of slugs) {
    const board = await getBoard(slug);
    if (board && !board.migratedTo) {
      results.push({ slug, title: board.title, hasPin: !!board.pin });
    }
  }
  return results;
}

/**
 * Mark a legacy board as migrated to an authenticated user
 */
export async function markBoardMigrated(slug: string, userId: string): Promise<void> {
  const board = await getBoard(slug);
  if (!board) return;
  board.migratedTo = userId;
  board.migratedAt = new Date().toISOString();
  await saveBoard(slug, board);
}

/**
 * Resolve the board key for an API request.
 * If a userId is provided (authenticated), use that.
 * Otherwise fall back to the slug (legacy).
 */
export function resolveBoardKey(userId: string | null, slug: string | null): string | null {
  return userId || slug;
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Prune trash items older than 30 days. Returns true if any were removed.
 */
export function pruneTrash(board: Board): boolean {
  if (!board.trash || board.trash.length === 0) return false;
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const before = board.trash.length;
  board.trash = board.trash.filter((j) => new Date(j.deletedAt).getTime() > cutoff);
  return board.trash.length !== before;
}
