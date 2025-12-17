'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateBoardForm() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // PIN protection state
  const [enablePin, setEnablePin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleSlugChange = (value: string) => {
    // Auto-format: lowercase, replace spaces with hyphens, remove invalid chars
    const formatted = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setSlug(formatted);
  };

  const handlePinChange = (value: string) => {
    // Only allow digits, max 6
    const formatted = value.replace(/\D/g, '').slice(0, 6);
    setPin(formatted);
  };

  const handleConfirmPinChange = (value: string) => {
    const formatted = value.replace(/\D/g, '').slice(0, 6);
    setConfirmPin(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate PIN if enabled
    if (enablePin) {
      if (pin.length < 4) {
        setError('PIN must be at least 4 digits');
        setLoading(false);
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/create-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slug,
          pin: enablePin ? pin : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create board');
        return;
      }

      router.push(`/b/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-7">
      <h2 className="text-2xl font-semibold tracking-tight mb-1">Create your board</h2>
      <p className="muted mb-5 text-sm">
        Pick a short name — it becomes your board URL.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Board name</label>
          <div className="flex items-center gap-2">
            <span className="muted text-sm">/b/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="katie"
              required
              className="input flex-1"
            />
          </div>
        </div>

        {/* PIN Protection Section */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enablePin}
              onChange={(e) => {
                setEnablePin(e.target.checked);
                if (!e.target.checked) {
                  setPin('');
                  setConfirmPin('');
                }
              }}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium">Protect with PIN</span>
          </label>
          
          {enablePin && (
            <div className="mt-3 space-y-3 pl-6">
              <div>
                <label className="block text-sm text-gray-600 mb-1">PIN (4-6 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  placeholder="••••"
                  className="input w-32"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => handleConfirmPinChange(e.target.value)}
                  placeholder="••••"
                  className="input w-32"
                  maxLength={6}
                />
              </div>
              <p className="text-xs text-gray-500">
                You&apos;ll need this PIN to access your board.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="callout callout-error">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !slug}
          className="btn btn-primary w-full"
        >
          {loading ? 'Creating...' : 'Create Board'}
        </button>
      </div>
    </form>
  );
}
