'use client';

export default function NetworkError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page">
      <div className="container-app max-w-5xl text-center py-20">
        <p className="text-lg font-medium mb-2">Something went wrong loading your network</p>
        <p className="text-sm muted mb-6">This is unexpected — try refreshing the page.</p>
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
      </div>
    </main>
  );
}
