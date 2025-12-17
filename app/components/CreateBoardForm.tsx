'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateBoardForm() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  const handleSlugChange = (value: string) => {
    const formatted = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setSlug(formatted);
  };

  const handlePinChange = (value: string) => {
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

    try {
      const response = await fetch('/api/create-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create board');
        return;
      }

      // Board created - show PIN modal
      setCreatedSlug(data.slug);
      setShowPinModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPin = () => {
    if (createdSlug) {
      router.push(`/b/${createdSlug}`);
    }
  };

  const handleSavePin = async () => {
    setPinError(null);

    if (pin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setSavingPin(true);

    try {
      const response = await fetch('/api/update-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: createdSlug,
          newPin: pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPinError(data.error || 'Failed to set PIN');
        return;
      }

      router.push(`/b/${createdSlug}`);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Failed to set PIN');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="card p-7">
        <h2 className="text-2xl font-semibold tracking-tight mb-1">Create your board</h2>
        <p className="muted mb-5 text-sm">Pick a short name — it becomes your board URL.</p>

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

          {error && <div className="callout callout-error">{error}</div>}

          <button type="submit" disabled={loading || !slug} className="btn btn-primary w-full">
            {loading ? 'Creating...' : 'Create Board'}
          </button>
        </div>
      </form>

      {/* PIN Setup Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-1">Board created! 🎉</h3>
              <p className="text-sm muted">
                Want to protect <span className="font-medium">/b/{createdSlug}</span> with a PIN?
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">PIN (4-6 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  placeholder="••••"
                  className="input w-full"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => handleConfirmPinChange(e.target.value)}
                  placeholder="••••"
                  className="input w-full"
                  maxLength={6}
                />
              </div>
              <p className="text-xs muted">
                You&apos;ll need this PIN to access your board. You can change this later.
              </p>
            </div>

            {pinError && <div className="callout callout-error text-sm">{pinError}</div>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSkipPin}
                className="btn btn-secondary flex-1"
                disabled={savingPin}
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleSavePin}
                className="btn btn-primary flex-1"
                disabled={savingPin || !pin}
              >
                {savingPin ? 'Saving...' : 'Add PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
