'use client';

import { useState } from 'react';
import { ImportBoardModal } from './ImportBoardModal';

export function ImportBoardButton({ variant = 'link' }: { variant?: 'link' | 'button' }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'button' ? (
        <button onClick={() => setIsOpen(true)} className="btn text-sm">
          Import existing board
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="text-sm muted hover:underline cursor-pointer"
        >
          Have an existing board? Import it →
        </button>
      )}
      {isOpen && <ImportBoardModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
