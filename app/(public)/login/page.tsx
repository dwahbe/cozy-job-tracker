'use client';

import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const isVerify = searchParams.has('verify');
  const callbackUrl = searchParams.get('callbackUrl') || '/board';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('resend', { email, callbackUrl, redirect: false });
      if (result?.error) {
        setError('Something went wrong — please try again.');
        setLoading(false);
      } else {
        router.push('/login?verify=1');
      }
    } catch {
      setError('Something went wrong — please try again.');
      setLoading(false);
    }
  }

  if (isVerify) {
    return (
      <main className="page">
        <div className="container-app max-w-md">
          <div className="card p-8 text-center">
            <h1 className="text-2xl font-bold mb-3">Check your email</h1>
            <p className="muted">
              A magic link is on its way. Click the link in your email to sign in.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container-app max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-2">Sign in</h1>
          <p className="muted mb-6">Enter your email to get a magic link. No password needed.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="input w-full"
              />
            </div>
            <button type="submit" disabled={loading || !email} className="btn btn-primary w-full">
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
