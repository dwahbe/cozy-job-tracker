'use client';

export type SortOption = 'added-desc' | 'due-asc' | 'status-asc' | 'status-desc';

interface SortSelectProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function SortSelect({ sortBy, onSortChange }: SortSelectProps) {
  return (
    <div className="sort-select-wrapper">
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="sort-icon"
      >
        <path
          d="M2 4h12M4 8h8M6 12h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="sort-select"
      >
        <option value="added-desc">Date added (newest)</option>
        <option value="due-asc">Due date (soonest)</option>
        <option value="status-asc">Status (Saved → Rejected)</option>
        <option value="status-desc">Status (Rejected → Saved)</option>
      </select>
    </div>
  );
}
