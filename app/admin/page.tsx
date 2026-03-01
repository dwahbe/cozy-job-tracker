import { verifySession } from '@/lib/dal';
import { isAdmin, getAdminStats } from '@/lib/admin';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin — cozy job tracker',
  robots: 'noindex',
};

export default async function AdminPage() {
  const { email } = await verifySession();

  if (!isAdmin(email)) {
    return (
      <main className="page">
        <div className="container-app max-w-md">
          <div className="card p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">no access</h1>
            <p className="muted">you don&apos;t have permission to view this page.</p>
          </div>
        </div>
      </main>
    );
  }

  const stats = await getAdminStats();

  return (
    <main className="page">
      <div className="container-app max-w-5xl">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-10">Admin</h1>

        <div className="space-y-10">
          {/* Users & Jobs */}
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <StatCard label="Total users" value={stats.totalUsers} />
              <StatCard label="Active users" value={stats.activeUsers} />
              <StatCard label="Jobs" value={stats.totalJobs} />
              <StatCard label="Trashed jobs" value={stats.totalTrashed} />
              <StatCard label="Avg jobs/user" value={stats.avgJobsPerUser} />
            </div>
            <div className="table-wrapper !mx-0">
              <table className="job-table">
                <thead>
                  <tr>
                    <th className="w-56">Email</th>
                    <th className="w-24">Name</th>
                    <th className="w-16">Jobs</th>
                    <th className="w-16">Trash</th>
                    <th className="w-28">Joined</th>
                    <th className="w-24">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.email}</td>
                      <td className="muted">{u.name || '—'}</td>
                      <td className="tabular-nums">{u.jobCount}</td>
                      <td className="tabular-nums muted">{u.trashCount}</td>
                      <td className="muted text-sm">
                        {u.emailVerified
                          ? new Date(u.emailVerified).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="font-mono text-xs muted">{u.id.slice(0, 8)}…</td>
                    </tr>
                  ))}
                  {stats.users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center muted py-8">
                        No users yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Legacy boards */}
          {stats.legacyBoards.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Legacy boards</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatCard label="Total" value={stats.totalLegacyBoards} />
                <StatCard label="Migrated" value={stats.migratedLegacyBoards} />
              </div>
              <div className="table-wrapper !mx-0">
                <table className="job-table">
                  <thead>
                    <tr>
                      <th>Slug</th>
                      <th>Title</th>
                      <th>Jobs</th>
                      <th>Trash</th>
                      <th>Migrated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.legacyBoards.map((b) => (
                      <tr key={b.slug}>
                        <td className="font-mono text-sm">{b.slug}</td>
                        <td>{b.title}</td>
                        <td className="tabular-nums">{b.jobCount}</td>
                        <td className="tabular-nums muted">{b.trashCount}</td>
                        <td>
                          {b.migrated ? (
                            <span className="text-sm text-success font-medium">Yes</span>
                          ) : (
                            <span className="text-sm muted">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-sm muted mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
