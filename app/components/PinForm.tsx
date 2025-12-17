'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PinFormProps {
  slug: string;
  boardTitle: string;
}

export function PinForm({ slug, boardTitle }: PinFormProps) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePinChange = (value: string) => {
    // Only allow digits, max 6
    const formatted = value.replace(/\D/g, '').slice(0, 6);
    setPin(formatted);
    setError(null); // Clear error when typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to verify PIN');
        setLoading(false);
        return;
      }

      // Reload page to show board content
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify PIN');
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <div className="container-app max-w-md">
        <div className="card p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-1">{boardTitle}</h1>
            <p className="text-sm text-gray-500">
              This board is protected. Enter the PIN to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="Enter PIN"
                className="input text-center text-lg tracking-widest w-full"
                maxLength={6}
                autoFocus
              />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="btn btn-primary w-full"
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
