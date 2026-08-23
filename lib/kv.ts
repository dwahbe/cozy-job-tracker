import { redis } from '@/lib/redis';
import type { Column } from './markdown';
import type { ValidatedJob } from './validateExtraction';
import { getOrderedColumnIds } from '@/lib/custom-column-utils';

/**
 * Board data structure for KV storage (one JSON blob per user at `board:{userId}`)
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
  jobs: Job[];
  trash?: TrashedJob[]; // Soft-deleted jobs (auto-pruned after 30 days)
  version?: number; // Bumped by every compare-and-set write (absent = 0 for older blobs)
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
  return getOrderedColumnIds(board.columnOrder, BUILTIN_COLUMN_IDS, board.columns);
}

// Re-export Column type
export type { Column };

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a Job from a validated URL extraction result
 */
export function createJobFromValidation(validatedJob: ValidatedJob, columns: Column[]): Job {
  const customFields: Record<string, string> = {};
  for (const col of columns) {
    customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
  }

  return {
    id: generateJobId(),
    title: validatedJob.title || 'Unknown Position',
    company: validatedJob.company || 'Unknown Company',
    link: validatedJob.finalUrl,
    location: validatedJob.location || 'Not listed',
    employmentType: validatedJob.employment_type || 'Not listed',
    notes: validatedJob.notes || '',
    status: 'Saved',
    dueDate: validatedJob.due_date || '',
    parsedOn: validatedJob.fetchedAt.split('T')[0],
    verified: validatedJob.isVerified ? 'Yes' : 'No',
    customFields,
  };
}

export function boardKey(userId: string): string {
  return `board:${userId}`;
}

/**
 * Get a board by userId
 */
export async function getBoardByUserId(userId: string): Promise<Board | null> {
  return await redis.get<Board>(boardKey(userId));
}

/**
 * Save a board for a user, unconditionally. Writes that build on a previous read should go
 * through withBoard() (lib/api-auth.ts), which uses compare-and-set instead.
 */
export async function saveBoardByUserId(userId: string, board: Board): Promise<void> {
  await redis.set(boardKey(userId), board);
}

export const DEFAULT_BOARD_TITLE = 'My job board';

/** A fresh, empty board — what a user has before their first write. */
export function createEmptyBoard(): Board {
  return { title: DEFAULT_BOARD_TITLE, columns: [], jobs: [] };
}

/**
 * The user's board, or an empty one if they haven't got one yet. Nothing is written here: the
 * first compare-and-set write (withBoard) creates the key, so a slow first-use create can never
 * overwrite an edit that landed in the meantime.
 */
export async function getBoardOrDefault(userId: string): Promise<Board> {
  return (await getBoardByUserId(userId)) ?? createEmptyBoard();
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
