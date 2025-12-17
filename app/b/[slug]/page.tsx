import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { parseBoardFile, parseJobsFromMarkdown } from '@/lib/markdown';
import { JobForm } from '@/app/components/JobForm';
import { JobsView } from '@/app/components/JobsView';
import { AddColumnForm } from '@/app/components/AddColumnForm';
import { PinForm } from '@/app/components/PinForm';
import { PinSettings } from '@/app/components/PinSettings';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const BOARDS_DIR = path.join(process.cwd(), 'content', 'boards');
const SLUG_REGEX = /^[a-z0-9-]+$/;

export default async function BoardPage({ params }: PageProps) {
  const { slug } = await params;

  // Validate slug
  if (!SLUG_REGEX.test(slug)) {
    notFound();
  }

  // Build safe path
  const boardPath = path.join(BOARDS_DIR, `${slug}.md`);
  const resolvedPath = path.resolve(boardPath);
  if (!resolvedPath.startsWith(path.resolve(BOARDS_DIR))) {
    notFound();
  }

  // Try to read the board file
  let fileContent: string;
  try {
    fileContent = await fs.readFile(boardPath, 'utf-8');
  } catch {
    notFound();
  }

  // Parse the board
  const boardData = parseBoardFile(fileContent);

  // Check PIN protection
  if (boardData.pin) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(`board_${slug}_auth`);
    
    // If no valid cookie, show PIN form
    if (!authCookie || authCookie.value !== 'verified') {
      return <PinForm slug={slug} boardTitle={boardData.title} />;
    }
  }

  const jobs = parseJobsFromMarkdown(boardData.content, boardData.columns);

  return (
    <main className="page">
      <div className="container-app max-w-5xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {boardData.title}
            </h1>
            <PinSettings slug={slug} hasPin={!!boardData.pin} />
          </div>
        </header>

        {/* Add Job Form */}
        <JobForm slug={slug} columns={boardData.columns} />

        {/* Column Manager */}
        <div className="mb-8">
          <AddColumnForm slug={slug} />
          {boardData.columns.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {boardData.columns.map((col) => (
                <span key={col.name} className="chip">
                  <span className="font-medium">{col.name}</span>
                  <span className="opacity-70">({col.type})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Jobs List */}
        <JobsView jobs={jobs} slug={slug} columns={boardData.columns} />
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;

  // Validate slug
  if (!SLUG_REGEX.test(slug)) {
    return { title: 'Board Not Found' };
  }

  const boardPath = path.join(BOARDS_DIR, `${slug}.md`);

  try {
    const fileContent = await fs.readFile(boardPath, 'utf-8');
    const boardData = parseBoardFile(fileContent);
    return {
      title: boardData.title,
      description: `${boardData.title} - Personal Job Board`,
    };
  } catch {
    return { title: 'Board Not Found' };
  }
}
