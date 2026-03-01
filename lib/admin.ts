import 'server-only';
import { kv } from '@vercel/kv';
import type { Board } from './kv';

export const ADMIN_EMAILS = new Set(['dylan@wahbe.com']);

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

interface AdapterUser {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: string | null;
  image?: string | null;
}

export interface UserStats {
  id: string;
  email: string;
  name: string | null;
  emailVerified: string | null;
  jobCount: number;
  trashCount: number;
}

export interface LegacyBoardStats {
  slug: string;
  title: string;
  jobCount: number;
  trashCount: number;
  migrated: boolean;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalLegacyBoards: number;
  migratedLegacyBoards: number;
  totalJobs: number;
  totalTrashed: number;
  avgJobsPerUser: number;
  users: UserStats[];
  legacyBoards: LegacyBoardStats[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const [userKeys, boardKeys] = await Promise.all([kv.keys('user:*'), kv.keys('board:*')]);

  // Filter to actual user records (exclude email/account lookup keys)
  const userRecordKeys = userKeys.filter(
    (k) => !k.startsWith('user:email:') && !k.startsWith('user:account:')
  );

  // Fetch all user records first so we know the real user IDs
  const userRecords = await Promise.all(userRecordKeys.map((k) => kv.get<AdapterUser>(k)));
  const knownUserIds = new Set(userRecords.filter((u): u is AdapterUser => u !== null).map((u) => u.id));

  // Separate auth boards (key matches a known userId) from legacy slug boards
  const allBoardIds = boardKeys.map((k) => k.replace('board:', ''));
  const authBoardIds = allBoardIds.filter((id) => knownUserIds.has(id));
  const legacySlugs = allBoardIds.filter((id) => !knownUserIds.has(id));

  // Fetch boards in parallel
  const authBoards = await Promise.all(authBoardIds.map((id) => kv.get<Board>(`board:${id}`)));
  const legacyBoards = await Promise.all(legacySlugs.map((s) => kv.get<Board>(`board:${s}`)));

  // Build a map of userId -> board for quick lookup
  const boardByUserId = new Map<string, Board>();
  authBoardIds.forEach((id, i) => {
    if (authBoards[i]) boardByUserId.set(id, authBoards[i]!);
  });

  // Build user stats
  const users: UserStats[] = userRecords
    .filter((u): u is AdapterUser => u !== null && !!u.email)
    .map((u) => {
      const board = boardByUserId.get(u.id);
      return {
        id: u.id,
        email: u.email!,
        name: u.name ?? null,
        emailVerified: u.emailVerified ?? null,
        jobCount: board?.jobs.length ?? 0,
        trashCount: board?.trash?.length ?? 0,
      };
    })
    .sort((a, b) => b.jobCount - a.jobCount);

  // Build legacy board stats
  const legacyBoardStats: LegacyBoardStats[] = legacySlugs
    .map((slug, i) => {
      const board = legacyBoards[i];
      if (!board) return null;
      return {
        slug,
        title: board.title,
        jobCount: board.jobs.length,
        trashCount: board.trash?.length ?? 0,
        migrated: !!board.migratedTo,
      };
    })
    .filter((b): b is LegacyBoardStats => b !== null)
    .sort((a, b) => b.jobCount - a.jobCount);

  let totalJobs = 0;
  let totalTrashed = 0;
  for (const u of users) {
    totalJobs += u.jobCount;
    totalTrashed += u.trashCount;
  }
  for (const b of legacyBoardStats) {
    totalJobs += b.jobCount;
    totalTrashed += b.trashCount;
  }

  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.jobCount > 0).length,
    totalLegacyBoards: legacyBoardStats.length,
    migratedLegacyBoards: legacyBoardStats.filter((b) => b.migrated).length,
    totalJobs,
    totalTrashed,
    avgJobsPerUser: users.length > 0 ? Math.round((totalJobs / users.length) * 10) / 10 : 0,
    users,
    legacyBoards: legacyBoardStats,
  };
}
