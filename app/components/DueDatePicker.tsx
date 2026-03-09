'use client';

import { useState, useRef, useEffect } from 'react';
import { formatDateDisplay } from '@/lib/job-utils';

interface DueDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DueDatePicker({
  value,
  onChange,
  disabled,
  placeholder = '\u2014',
}: DueDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(false);
  };

  const handleRollingClick = () => {
    onChange('rolling');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const displayText = value ? formatDateDisplay(value) : placeholder;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="hover:underline underline-offset-2 text-left whitespace-nowrap"
      >
        {displayText}
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-surface-solid border border-border rounded-lg shadow-lg p-3 min-w-[200px]"
        >
          <div className="space-y-2">
            <input
              type="date"
              value={value === 'rolling' ? '' : value}
              onChange={handleDateChange}
              className="input w-full text-sm"
            />
            <button
              type="button"
              onClick={handleRollingClick}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                value === 'rolling' ? 'bg-accent-soft text-accent' : 'hover:bg-black/5'
              }`}
            >
              🔄 Rolling basis
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-left px-3 py-2 rounded-md text-sm muted hover:bg-black/5 transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
