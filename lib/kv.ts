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

export interface Board {
  title: string;
  columns: Column[];
  pin?: string; // bcrypt hash
  jobs: Job[];
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
