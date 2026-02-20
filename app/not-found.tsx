import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page">
      <div className="container-app max-w-md">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold mb-6">page not found</h1>
          <Link href="/" className="btn btn-primary inline-block">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
