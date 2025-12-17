'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PinSettingsProps {
  slug: string;
  hasPin: boolean;
}

type Mode = 'idle' | 'add' | 'change' | 'remove';

export function PinSettings({ slug, hasPin }: PinSettingsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setMode('idle');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  const formatPin = (value: string) => value.replace(/\D/g, '').slice(0, 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (mode === 'add' || mode === 'change') {
      if (newPin.length < 4) {
        setError('PIN must be at least 4 digits');
        return;
      }
      if (newPin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
    }

    if ((mode === 'change' || mode === 'remove') && currentPin.length < 4) {
      setError('Enter your current PIN');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/update-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          currentPin: hasPin ? currentPin : undefined,
          newPin: mode === 'remove' ? null : newPin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update PIN');
        setLoading(false);
        return;
      }

      // Success - refresh the page
      handleClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PIN');
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="PIN Settings"
      >
        {hasPin ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={handleClose} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border z-50 p-4">
            {mode === 'idle' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-2 h-2 rounded-full ${hasPin ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                  <span className="text-gray-600">
                    {hasPin ? 'Protected with PIN' : 'Not protected'}
                  </span>
                </div>

                <div className="space-y-2">
                  {!hasPin && (
                    <button
                      onClick={() => setMode('add')}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-50 transition-colors"
                    >
                      Add PIN protection
                    </button>
                  )}
                  {hasPin && (
                    <>
                      <button
                        onClick={() => setMode('change')}
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-50 transition-colors"
                      >
                        Change PIN
                      </button>
                      <button
                        onClick={() => setMode('remove')}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 rounded hover:bg-red-50 transition-colors"
                      >
                        Remove PIN
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <h3 className="font-medium text-sm">
                  {mode === 'add' && 'Add PIN Protection'}
                  {mode === 'change' && 'Change PIN'}
                  {mode === 'remove' && 'Remove PIN'}
                </h3>

                {(mode === 'change' || mode === 'remove') && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Current PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(formatPin(e.target.value))}
                      className="input w-full text-sm"
                      placeholder="••••"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                )}

                {(mode === 'add' || mode === 'change') && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        {mode === 'change' ? 'New PIN' : 'PIN'} (4-6 digits)
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={newPin}
                        onChange={(e) => setNewPin(formatPin(e.target.value))}
                        className="input w-full text-sm"
                        placeholder="••••"
                        maxLength={6}
                        autoFocus={mode === 'add'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Confirm PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(formatPin(e.target.value))}
                        className="input w-full text-sm"
                        placeholder="••••"
                        maxLength={6}
                      />
                    </div>
                  </>
                )}

                {mode === 'remove' && (
                  <p className="text-xs text-gray-500">
                    Anyone with the link will be able to view this board.
                  </p>
                )}

                {error && <div className="text-xs text-red-600">{error}</div>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-secondary flex-1 text-sm py-1.5"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn flex-1 text-sm py-1.5 ${mode === 'remove' ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'}`}
                    disabled={loading}
                  >
                    {loading ? '...' : mode === 'remove' ? 'Remove' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
