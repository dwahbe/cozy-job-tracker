'use client';

import { useState } from 'react';

const themes = [
  { id: '', label: 'Current (amber)', color: '#d97706' },
  { id: 'berry', label: 'Berry Pop', color: '#c2185b' },
  { id: 'indigo', label: 'Electric Indigo', color: '#4f46e5' },
  { id: 'forest', label: 'Forest & Gold', color: '#16a34a' },
] as const;

export function ThemeSwitcher() {
  const [active, setActive] = useState('');

  function switchTheme(id: string) {
    setActive(id);
    if (id) {
      document.documentElement.setAttribute('data-theme', id);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
      }}
    >
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => switchTheme(t.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-full)',
            border: active === t.id ? `2px solid ${t.color}` : '2px solid var(--border)',
            background: active === t.id ? `${t.color}12` : 'var(--surface-solid)',
            color: active === t.id ? t.color : 'var(--muted-2)',
            fontWeight: active === t.id ? 700 : 550,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: t.color,
              flexShrink: 0,
            }}
          />
          {t.label}
        </button>
      ))}
    </div>
  );
}
