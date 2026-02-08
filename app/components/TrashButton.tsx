import Link from 'next/link';

export function TrashButton({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="flex justify-end mt-6">
      <Link
        href="/trash"
        className="inline-flex items-center gap-1.5 text-sm muted hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-foreground/5"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2 3.5h10M5.5 3.5V2a1 1 0 011-1h1a1 1 0 011 1v1.5M11 3.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Trash ({count})
      </Link>
    </div>
  );
}
