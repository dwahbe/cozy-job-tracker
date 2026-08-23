import { kv } from '@vercel/kv';
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

/**
 * Get a board by userId
 */
export async function getBoardByUserId(userId: string): Promise<Board | null> {
  return await kv.get<Board>(`board:${userId}`);
}

/**
 * Save a board for a user
 */
export async function saveBoardByUserId(userId: string, board: Board): Promise<void> {
  await kv.set(`board:${userId}`, board);
}

export const DEFAULT_BOARD_TITLE = 'My job board';

/**
 * Get the user's board, creating an empty one on first use.
 */
export async function getOrCreateBoard(userId: string): Promise<Board> {
  const existing = await getBoardByUserId(userId);
  if (existing) return existing;
  const board: Board = { title: DEFAULT_BOARD_TITLE, columns: [], jobs: [] };
  await saveBoardByUserId(userId, board);
  return board;
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
