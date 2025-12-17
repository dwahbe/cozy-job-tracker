import Link from 'next/link';
import { listBoards } from '@/lib/kv';
import { CreateBoardForm } from './components/CreateBoardForm';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const boards = await listBoards();

  return (
    <main className="page">
      <div className="container-app max-w-3xl">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            track your job hunt, stress-free 🌱
          </h1>
          <p className="text-base sm:text-lg muted max-w-2xl">
            create a board, paste a job url, and track your applications in one cozy spot.
          </p>
        </div>

        {/* Create Board Form */}
        <div className="mb-10">
          <CreateBoardForm />
        </div>

        {/* Existing Boards */}
        {boards.length > 0 && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Friends in this with you</h2>
            <div className="space-y-2">
              {boards.map((board) => (
                <Link key={board} href={`/b/${board}`} className="card card-hover block p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">/b/{board}</span>
                    <span className="text-sm muted">Open →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
