'use client';

import { useState, useRef, useEffect } from 'react';
import type { Column } from '@/lib/markdown';

export interface SortRule {
  field: string;
  direction: 'asc' | 'desc';
}

const BUILTIN_SORT_FIELDS = [
  { id: 'parsedOn', label: 'Date added' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'status', label: 'Status' },
  { id: 'title', label: 'Title' },
  { id: 'company', label: 'Company' },
  { id: 'location', label: 'Location' },
  { id: 'employmentType', label: 'Type' },
  { id: 'notes', label: 'Notes' },
];

interface SortBuilderProps {
  sorts: SortRule[];
  onSortsChange: (sorts: SortRule[]) => void;
  columns: Column[];
}

export function SortBuilder({ sorts, onSortsChange, columns }: SortBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const allFields = [
    ...BUILTIN_SORT_FIELDS,
    ...columns.map((c) => ({ id: `custom:${c.name}`, label: c.name })),
  ];

  // Calculate popover position from button rect
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
        zIndex: 9999,
      });
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const addSort = () => {
    const usedFields = new Set(sorts.map((s) => s.field));
    const available = allFields.find((f) => !usedFields.has(f.id));
    if (!available) return;
    onSortsChange([...sorts, { field: available.id, direction: 'asc' }]);
  };

  const removeSort = (index: number) => {
    onSortsChange(sorts.filter((_, i) => i !== index));
  };

  const updateSort = (index: number, update: Partial<SortRule>) => {
    onSortsChange(sorts.map((s, i) => (i === index ? { ...s, ...update } : s)));
  };

  const clearAll = () => {
    onSortsChange([]);
    setIsOpen(false);
  };

  const hasActiveSorts = sorts.length > 0;
  const canAddMore = sorts.length < allFields.length;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
        className={`sort-btn ${hasActiveSorts ? 'sort-btn-active' : ''}`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2 4h12M4 8h8M6 12h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="sort-btn-label">Sort</span>
        {hasActiveSorts && <span className="sort-count">{sorts.length}</span>}
      </button>

      {isOpen && (
        <div ref={popoverRef} style={popoverStyle} className="sort-popover">
          {sorts.length === 0 ? (
            <div className="sort-empty">
              <p className="sort-empty-text">No sorts applied</p>
              <button onClick={addSort} className="sort-add-btn">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 2v8M2 6h8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Add a sort
              </button>
            </div>
          ) : (
            <>
              <div className="sort-rules">
                {sorts.map((sort, index) => (
                  <div key={index} className="sort-rule">
                    <span className="sort-rule-label">{index === 0 ? 'Sort by' : 'then'}</span>
                    <select
                      value={sort.field}
                      onChange={(e) => updateSort(index, { field: e.target.value })}
                      className="sort-field-select"
                    >
                      {allFields.map((f) => (
                        <option
                          key={f.id}
                          value={f.id}
                          disabled={sorts.some((s, i) => i !== index && s.field === f.id)}
                        >
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sort.direction}
                      onChange={(e) =>
                        updateSort(index, { direction: e.target.value as 'asc' | 'desc' })
                      }
                      className="sort-dir-select"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                    <button
                      onClick={() => removeSort(index)}
                      className="sort-remove-btn"
                      aria-label="Remove sort"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M3 3l6 6M9 3l-6 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="sort-actions">
                {canAddMore ? (
                  <button onClick={addSort} className="sort-add-btn">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M6 2v8M2 6h8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    Add a sort
                  </button>
                ) : (
                  <span />
                )}
                <button onClick={clearAll} className="sort-clear-btn">
                  Delete sort{sorts.length > 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
