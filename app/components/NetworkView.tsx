'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Person, PersonStatus } from '@/lib/network';
import { STATUS_LABELS, PERSON_STATUSES, PREBUILT_NETWORK_COLUMNS } from '@/lib/network';
import type { Column } from '@/lib/markdown';
import type { ParsedJob } from '@/lib/markdown';
import type { SortRule } from '@/lib/kv';
import { AddPersonForm } from './AddPersonForm';
import { NetworkTable } from './NetworkTable';
import { BoardColumnManager } from './BoardColumnManager';
import { OrbitView } from './OrbitView';
import { SortBuilder } from './SortSelect';
import { TrashButton } from './TrashButton';

type ViewMode = 'table' | 'orbit';

const NETWORK_SORT_FIELDS = [
  { id: 'name', label: 'Name' },
  { id: 'company', label: 'Company' },
  { id: 'role', label: 'Role' },
  { id: 'status', label: 'Status' },
  { id: 'lastContacted', label: 'Last contacted' },
];

const STATUS_ORDER = PERSON_STATUSES as readonly PersonStatus[];

const PREBUILT_DESCRIPTIONS: Record<string, string> = {
  Relationship: 'Friend, ex-coworker, recruiter, alum...',
  Strength: 'How well you know them',
  'Next action': 'What to do next',
  'Follow-up date': 'When to follow up',
  Notes: 'Freeform notes',
  Location: 'Where they are based',
  'Last contacted': 'Track when you last reached out',
};

function getNetworkSortValue(person: Person, field: string): string {
  switch (field) {
    case 'name':
      return person.name;
    case 'company':
      return person.company;
    case 'role':
      return person.role;
    case 'status':
      return person.status;
    case 'lastContacted':
      return person.lastContacted || '';
    default:
      if (field.startsWith('custom:')) return person.customFields[field.slice(7)] || '';
      return '';
  }
}

interface NetworkViewProps {
  people: Person[];
  columns: Column[];
  columnOrder: string[];
  showLinkedJobs: boolean;
  jobs: ParsedJob[];
  userName: string | null;
  trashCount: number;
}

export function NetworkView({
  people: serverPeople,
  columns,
  columnOrder,
  showLinkedJobs,
  jobs,
  userName,
  trashCount,
}: NetworkViewProps) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('table');

  useEffect(() => {
    const saved = localStorage.getItem('network-view') as ViewMode | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'orbit') setView('orbit');
  }, []);

  const [sorts, setSorts] = useState<SortRule[]>([]);
  const [search, setSearch] = useState('');
  const [highlightPersonId, setHighlightPersonId] = useState<string | null>(null);
  const [parsingUrl, setParsingUrl] = useState<string | null>(null);

  const switchView = useCallback((v: ViewMode) => {
    setView(v);
    if (typeof window !== 'undefined') localStorage.setItem('network-view', v);
  }, []);

  const dropdownOrders = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const col of columns) {
      if (col.type === 'dropdown' && col.options) {
        m.set(`custom:${col.name}`, col.options);
      }
    }
    return m;
  }, [columns]);

  const sortedPeople = useMemo(() => {
    if (sorts.length === 0) return serverPeople;

    return [...serverPeople].sort((a, b) => {
      for (const rule of sorts) {
        const aVal = getNetworkSortValue(a, rule.field);
        const bVal = getNetworkSortValue(b, rule.field);

        if (!aVal && !bVal) continue;
        if (!aVal) return 1;
        if (!bVal) return -1;

        let cmp: number;

        if (rule.field === 'status') {
          cmp =
            STATUS_ORDER.indexOf(aVal as PersonStatus) - STATUS_ORDER.indexOf(bVal as PersonStatus);
        } else if (dropdownOrders.has(rule.field)) {
          const opts = dropdownOrders.get(rule.field)!;
          cmp = opts.indexOf(aVal) - opts.indexOf(bVal);
        } else {
          cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
        }

        if (rule.direction === 'desc') cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [serverPeople, sorts, dropdownOrders]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedPeople;
    return sortedPeople.filter((p) => {
      const haystack = [
        p.name,
        p.company,
        p.role,
        STATUS_LABELS[p.status as PersonStatus],
        p.lastContacted,
        ...Object.values(p.customFields),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedPeople, search]);

  const handleManualAdd = useCallback(() => {
    setParsingUrl(null);
  }, []);

  const isFiltered = search.trim().length > 0;

  // -- BoardColumnManager callbacks -----------------------------------------

  const handleAddColumn = useCallback(
    async (column: Column): Promise<boolean> => {
      try {
        const res = await fetch('/api/network/add-column', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ column }),
        });
        if (res.ok) router.refresh();
        return res.ok;
      } catch {
        return false;
      }
    },
    [router]
  );

  const handleEditColumn = useCallback(
    async (oldName: string, column: Column): Promise<boolean> => {
      try {
        const res = await fetch('/api/network/manage-column', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            columnName: oldName,
            updates: {
              name: column.name,
              type: column.type,
              options: column.options,
              optionColors: column.optionColors,
            },
          }),
        });
        if (res.ok) router.refresh();
        return res.ok;
      } catch {
        return false;
      }
    },
    [router]
  );

  const handleDeleteColumn = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/network/manage-column', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', columnName: name }),
        });
        if (res.ok) router.refresh();
        return res.ok;
      } catch {
        return false;
      }
    },
    [router]
  );

  const handleReorderColumns = useCallback(
    async (names: string[]): Promise<boolean> => {
      try {
        const currentBuiltinOrder = columnOrder.filter((id) => id.startsWith('_'));
        const newOrder = [...currentBuiltinOrder, ...names];
        const res = await fetch('/api/network/reorder-columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnOrder: newOrder }),
        });
        if (res.ok) router.refresh();
        return res.ok;
      } catch {
        return false;
      }
    },
    [router, columnOrder]
  );

  const handleToggleLinkedJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/network/add-column', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleLinkedJobs: !showLinkedJobs }),
      });
      if (res.ok) router.refresh();
    } catch {
      // Silent fail
    }
  }, [router, showLinkedJobs]);

  const showLastContacted = columnOrder.includes('_lastContacted');

  const handleToggleLastContacted = useCallback(async () => {
    try {
      const newOrder = showLastContacted
        ? columnOrder.filter((c) => c !== '_lastContacted')
        : [...columnOrder, '_lastContacted'];
      const res = await fetch('/api/network/reorder-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnOrder: newOrder }),
      });
      if (res.ok) router.refresh();
    } catch {
      // Silent fail
    }
  }, [router, columnOrder, showLastContacted]);

  return (
    <>
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
          Your network
          <span className="ml-2 align-middle inline-block text-xs font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-purple-500/12 text-purple-600 dark:text-purple-400">
            beta
          </span>
        </h1>
      </header>

      <AddPersonForm onManualAdd={handleManualAdd} />

      <BoardColumnManager
        columns={columns}
        prebuiltColumns={PREBUILT_NETWORK_COLUMNS}
        prebuiltDescriptions={PREBUILT_DESCRIPTIONS}
        extraToggles={[
          {
            label: 'Last contacted',
            description: 'Track when you last reached out',
            active: showLastContacted,
            onToggle: handleToggleLastContacted,
          },
          {
            label: 'Linked jobs',
            description: 'Connect people to jobs on your board',
            active: showLinkedJobs,
            onToggle: handleToggleLinkedJobs,
          },
        ]}
        onAddColumn={handleAddColumn}
        onEditColumn={handleEditColumn}
        onDeleteColumn={handleDeleteColumn}
        onReorderColumns={handleReorderColumns}
      />

      {serverPeople.length === 0 && !parsingUrl ? (
        <div className="text-center py-16">
          <p className="text-lg muted">Add someone you&apos;d like to stay in touch with.</p>
        </div>
      ) : (
        <>
          <div className="jobs-toolbar">
            <div className="jobs-toolbar-search-row">
              {view === 'table' && (
                <>
                  <div className="search-wrapper jobs-toolbar-search">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="search-icon"
                    >
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M11 11l3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search people..."
                      className="search-input"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="search-clear"
                        aria-label="Clear search"
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
                    )}
                  </div>
                  <p className="muted text-sm whitespace-nowrap">
                    {isFiltered
                      ? `${filteredPeople.length} of ${serverPeople.length}`
                      : serverPeople.length}{' '}
                    {serverPeople.length === 1 ? 'person' : 'people'}
                  </p>
                </>
              )}
              {view === 'orbit' && <div className="flex-1" />}
            </div>
            <div className="jobs-toolbar-controls">
              {view === 'table' && (
                <SortBuilder
                  sorts={sorts}
                  onSortsChange={setSorts}
                  columns={columns}
                  builtinFields={NETWORK_SORT_FIELDS}
                />
              )}
              <div className="view-toggle shrink-0">
                <button
                  onClick={() => switchView('table')}
                  className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
                >
                  Table
                </button>
                <button
                  onClick={() => switchView('orbit')}
                  className={`view-toggle-btn ${view === 'orbit' ? 'active' : ''}`}
                >
                  Orbit
                </button>
              </div>
            </div>
          </div>

          {view === 'table' ? (
            filteredPeople.length === 0 && isFiltered ? (
              <div className="card p-10 text-center">
                <p className="text-lg font-semibold mb-1">No matches</p>
                <p className="muted text-sm">
                  Nothing matched &ldquo;{search.trim()}&rdquo; —{' '}
                  <button
                    onClick={() => setSearch('')}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    clear search
                  </button>
                </p>
              </div>
            ) : (
              <NetworkTable
                people={filteredPeople}
                columns={columns}
                columnOrder={columnOrder}
                showLinkedJobs={showLinkedJobs}
                jobs={jobs}
                parsingUrl={parsingUrl}
                highlightPersonId={highlightPersonId}
                onHighlightDone={() => setHighlightPersonId(null)}
              />
            )
          ) : (
            <OrbitView people={filteredPeople} columns={columns} userName={userName} />
          )}
        </>
      )}

      <TrashButton count={trashCount} href="/network/trash" />
    </>
  );
}
