import 'server-only';
import { redis } from '@/lib/redis';
import { boardKey } from '@/lib/kv';
import type { Board } from '@/lib/kv';
import { listUserIds } from './users';

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

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalJobs: number;
  totalTrashed: number;
  avgJobsPerUser: number;
  users: UserStats[];
}

const EMPTY_STATS: AdminStats = {
  totalUsers: 0,
  activeUsers: 0,
  totalJobs: 0,
  totalTrashed: 0,
  avgJobsPerUser: 0,
  users: [],
};

export async function getAdminStats(): Promise<AdminStats> {
  const userIds = await listUserIds();
  if (userIds.length === 0) return EMPTY_STATS;

  // board:{userId} is derivable from user:{userId}, so both lookups can go out together.
  const [userRecords, boards] = await Promise.all([
    redis.mget<(AdapterUser | null)[]>(userIds.map((id) => `user:${id}`)),
    redis.mget<(Board | null)[]>(userIds.map(boardKey)),
  ]);

  const users: UserStats[] = userRecords
    .map((user, i) => ({ user, board: boards[i] }))
    .filter((x): x is { user: AdapterUser; board: Board | null } => !!x.user && !!x.user.email)
    .map(({ user: u, board }) => ({
      id: u.id,
      email: u.email!,
      name: u.name ?? null,
      emailVerified: u.emailVerified ?? null,
      jobCount: board?.jobs.length ?? 0,
      trashCount: board?.trash?.length ?? 0,
    }))
    .sort((a, b) => b.jobCount - a.jobCount);

  const totalJobs = users.reduce((n, u) => n + u.jobCount, 0);
  const totalTrashed = users.reduce((n, u) => n + u.trashCount, 0);

  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.jobCount > 0).length,
    totalJobs,
    totalTrashed,
    avgJobsPerUser: users.length > 0 ? Math.round((totalJobs / users.length) * 10) / 10 : 0,
    users,
  };
}
