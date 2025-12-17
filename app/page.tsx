import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { CreateBoardForm } from './components/CreateBoardForm';

const BOARDS_DIR = path.join(process.cwd(), 'content', 'boards');

async function getBoards() {
  try {
    const files = await fs.readdir(BOARDS_DIR);
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const boards = await getBoards();

  return (
    <main className="page">
      <div className="container-app max-w-3xl">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            Your cozy little job tracker
          </h1>
          <p className="text-base sm:text-lg muted max-w-2xl">
            Paste a job URL, let the parser pull the details, and keep everything tidy in your own
            board.
          </p>
        </div>

        {/* Create Board Form */}
        <div className="mb-10">
          <CreateBoardForm />
        </div>

        {/* Existing Boards */}
        {boards.length > 0 && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Existing boards</h2>
            <div className="space-y-2">
              {boards.map((board) => (
                <Link
                  key={board}
                  href={`/b/${board}`}
                  className="card card-hover block p-4"
                >
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
