'use client';

interface ViewToggleProps {
  view: 'cards' | 'table';
  onViewChange: (view: 'cards' | 'table') => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <button
        onClick={() => onViewChange('table')}
        className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
        aria-pressed={view === 'table'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M1 3h14M1 8h14M1 13h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>Table</span>
      </button>
      <button
        onClick={() => onViewChange('cards')}
        className={`view-toggle-btn ${view === 'cards' ? 'active' : ''}`}
        aria-pressed={view === 'cards'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>Cards</span>
      </button>
    </div>
  );
}
