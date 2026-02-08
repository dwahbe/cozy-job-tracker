'use client';

import { useState, useRef, useEffect } from 'react';
import {
  DROPDOWN_COLORS,
  DROPDOWN_COLOR_SWATCHES,
  type DropdownColor,
} from '@/lib/dropdown-colors';

export interface OptionEntry {
  value: string;
  color?: string;
}

interface DropdownOptionsEditorProps {
  options: OptionEntry[];
  onChange: (options: OptionEntry[]) => void;
}

function ColorPickerPopover({
  selectedColor,
  onSelect,
  onClose,
}: {
  selectedColor?: string;
  onSelect: (color?: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 p-2 rounded-lg border border-border bg-surface-solid shadow-lg"
    >
      <div className="flex gap-1.5 items-center">
        {/* No color option */}
        <button
          type="button"
          onClick={() => {
            onSelect(undefined);
            onClose();
          }}
          className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: !selectedColor ? 'var(--accent)' : 'var(--border)',
          }}
          title="No color"
        >
          {!selectedColor && (
            <svg className="w-3 h-3 text-muted-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2.5} d="M18 6L6 18" />
            </svg>
          )}
        </button>
        {DROPDOWN_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              onSelect(color);
              onClose();
            }}
            className="w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110"
            style={{
              background: DROPDOWN_COLOR_SWATCHES[color],
              boxShadow: selectedColor === color ? `0 0 0 2px var(--surface-solid), 0 0 0 4px ${DROPDOWN_COLOR_SWATCHES[color]}` : 'none',
            }}
            title={color.charAt(0).toUpperCase() + color.slice(1)}
          />
        ))}
      </div>
    </div>
  );
}

export function DropdownOptionsEditor({ options, onChange }: DropdownOptionsEditorProps) {
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);

  const updateOption = (index: number, updates: Partial<OptionEntry>) => {
    const next = options.map((opt, i) => (i === index ? { ...opt, ...updates } : opt));
    onChange(next);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const addOption = () => {
    onChange([...options, { value: '' }]);
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Options</label>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* Color swatch */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenPickerIndex(openPickerIndex === i ? null : i)}
                className="w-6 h-6 rounded-full border border-border shrink-0 transition-transform hover:scale-110"
                style={{
                  background: opt.color
                    ? DROPDOWN_COLOR_SWATCHES[opt.color as DropdownColor]
                    : 'var(--surface-solid)',
                }}
                title="Set color"
              />
              {openPickerIndex === i && (
                <ColorPickerPopover
                  selectedColor={opt.color}
                  onSelect={(color) => updateOption(i, { color })}
                  onClose={() => setOpenPickerIndex(null)}
                />
              )}
            </div>
            {/* Option value */}
            <input
              type="text"
              value={opt.value}
              onChange={(e) => updateOption(i, { value: e.target.value })}
              placeholder={`Option ${i + 1}`}
              className="input flex-1"
            />
            {/* Remove */}
            {options.length > 1 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="p-1 rounded hover:bg-danger-soft text-danger shrink-0"
                title="Remove option"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addOption}
        className="mt-2 text-sm text-accent hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}
