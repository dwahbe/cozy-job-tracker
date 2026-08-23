'use client';

import type { Person, PersonStatus } from '@/lib/network';
import { BUILTIN_NETWORK_COLUMN_LABELS, STATUS_LABELS, PERSON_STATUSES } from '@/lib/network';
import type { Column, ParsedJob } from '@/lib/markdown';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { BoardTable, type BoardColumnDef, type CellHelpers } from './BoardTable';
import { showToast } from './Toast';

interface NetworkTableProps {
  people: Person[];
  columns: Column[];
  columnOrder: string[];
  showLinkedJobs: boolean;
  jobs: ParsedJob[];
  highlightPersonId: string | null;
  onHighlightDone: () => void;
}

/** POST JSON and surface the server's message as a toast when it fails. */
async function postJson(url: string, body: unknown, fallback: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return true;
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    showToast(typeof data.error === 'string' && data.error ? data.error : fallback);
    return false;
  } catch {
    showToast(`${fallback} — check your connection.`);
    return false;
  }
}

function LinkedJobsCell({
  person,
  jobs,
  helpers,
}: {
  person: Person;
  jobs: ParsedJob[];
  helpers: CellHelpers<Person>;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const dropW = 360;
      const dropH = 280;
      const fitsBelow = r.bottom + dropH + 8 < window.innerHeight;
      const fitsRight = r.left + dropW + 16 < window.innerWidth;
      setStyle({
        position: 'fixed',
        ...(fitsBelow ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
        ...(fitsRight ? { left: r.left } : { right: window.innerWidth - r.right }),
        zIndex: 9999,
      });
    }
    setOpen(true);
  };

  // Click outside, Escape, or scrolling (the popover is position: fixed) closes it.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target as Node) &&
        dropRef.current &&
        !dropRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  // Optimistic ids while a toggle is in flight; reset when the server value changes.
  const serverKey = person.linkedJobIds.join(',');
  const [prevServerKey, setPrevServerKey] = useState(serverKey);
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null);

  if (serverKey !== prevServerKey) {
    setPrevServerKey(serverKey);
    setOptimisticIds(null);
  }

  const activeIds = optimisticIds ?? person.linkedJobIds;
  const linked = new Set(activeIds);

  const toggle = async (jobId: string) => {
    const next = new Set(linked);
    if (next.has(jobId)) next.delete(jobId);
    else next.add(jobId);
    const arr = [...next];
    setOptimisticIds(arr);
    const ok = await helpers.updateField(person.id, 'linkedJobIds', JSON.stringify(arr));
    if (!ok) setOptimisticIds(null); // roll back to the server's list
  };

  const linkedJobs = activeIds.map((id) => jobs.find((j) => j.id === id)).filter(Boolean);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            openDropdown();
          }
        }}
        className="text-left w-full"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Linked jobs for ${person.name || 'this person'}`}
      >
        {linkedJobs.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {linkedJobs.map((j) => (
              <span key={j!.id} className="chip text-xs truncate max-w-[140px]">
                {j!.company || j!.title || 'Job'}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-3 text-xs hover:text-foreground transition-colors">
            + link
          </span>
        )}
      </button>
      {open && (
        <div
          ref={dropRef}
          style={style}
          data-popover="linked-jobs"
          role="listbox"
          aria-multiselectable="true"
          className="bg-surface-solid border border-border rounded-lg shadow-lg p-2 w-[360px] max-h-[260px] overflow-y-auto"
        >
          {jobs.length === 0 ? (
            <p className="text-xs muted px-2 py-1">No jobs on your board yet</p>
          ) : (
            jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                role="option"
                aria-selected={linked.has(j.id)}
                onClick={() => toggle(j.id)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-black/5 transition-colors"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${linked.has(j.id) ? 'bg-accent border-accent text-white' : 'border-border'}`}
                >
                  {linked.has(j.id) && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3.5 8.5l3 3 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="truncate min-w-0">
                  {j.title || j.company || 'Untitled'}
                  {j.title && j.company && <span className="muted ml-1">at {j.company}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_CLASS: Record<PersonStatus, string> = {
  'not-contacted': 'network-status-not-contacted',
  'reached-out': 'network-status-reached-out',
  waiting: 'network-status-waiting',
  'in-conversation': 'network-status-in-conversation',
  paused: 'network-status-paused',
};

export function NetworkTable({
  people,
  columns,
  columnOrder,
  showLinkedJobs,
  jobs,
  highlightPersonId,
  onHighlightDone,
}: NetworkTableProps) {
  // -- Column definitions ---------------------------------------------------

  const builtinColumns: BoardColumnDef<Person>[] = useMemo(() => {
    const cols: BoardColumnDef<Person>[] = [
      {
        id: '_name',
        label: BUILTIN_NETWORK_COLUMN_LABELS._name,
        field: 'name',
        type: 'text',
        getValue: (p) => p.name,
        primaryColumn: true,
      },
      {
        id: '_company',
        label: BUILTIN_NETWORK_COLUMN_LABELS._company,
        field: 'company',
        type: 'text',
        getValue: (p) => p.company,
      },
      {
        id: '_role',
        label: BUILTIN_NETWORK_COLUMN_LABELS._role,
        field: 'role',
        type: 'text',
        getValue: (p) => p.role,
      },
      {
        id: '_linkedin',
        label: BUILTIN_NETWORK_COLUMN_LABELS._linkedin,
        field: 'linkedinUrl',
        type: 'link',
        getValue: (p) => p.linkedinUrl,
      },
      {
        id: '_status',
        label: BUILTIN_NETWORK_COLUMN_LABELS._status,
        field: 'status',
        type: 'select',
        getValue: (p) => p.status,
        options: PERSON_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
        optionColorClass: (v) => STATUS_CLASS[v as PersonStatus] || '',
      },
      {
        id: '_lastContacted',
        label: BUILTIN_NETWORK_COLUMN_LABELS._lastContacted,
        field: 'lastContacted',
        type: 'date',
        getValue: (p) => p.lastContacted || '',
      },
    ];

    if (showLinkedJobs) {
      cols.push({
        id: '_linkedJobs',
        label: 'Linked jobs',
        // The cell writes `linkedJobIds` as JSON, so read it back the same way — that lets the
        // table's optimistic-update reconcile recognise the server value once it lands.
        field: 'linkedJobIds',
        type: 'custom',
        getValue: (p) => JSON.stringify(p.linkedJobIds),
        render: (person, helpers) => (
          <LinkedJobsCell person={person} jobs={jobs} helpers={helpers} />
        ),
      });
    }

    return cols;
  }, [showLinkedJobs, jobs]);

  // -- Effective column order (append _linkedJobs if not in order) ----------

  const effectiveOrder = useMemo(() => {
    if (showLinkedJobs && !columnOrder.includes('_linkedJobs')) {
      return [...columnOrder, '_linkedJobs'];
    }
    return columnOrder;
  }, [columnOrder, showLinkedJobs]);

  // -- API callbacks --------------------------------------------------------

  const handleUpdateField = useCallback(
    (personId: string, field: string, value: string) =>
      postJson(
        '/api/network/update-person',
        { personId, fields: [{ field, value }] },
        "Couldn't save that change."
      ),
    []
  );

  const handleUpdateFields = useCallback(
    (personId: string, fields: { field: string; value: string }[]) =>
      postJson('/api/network/update-person', { personId, fields }, "Couldn't save that change."),
    []
  );

  const handleDeleteItem = useCallback(
    (personId: string) =>
      postJson('/api/network/delete-person', { personId }, "Couldn't move them to trash."),
    []
  );

  const handleReorderColumns = useCallback(
    (order: string[]) =>
      postJson(
        '/api/network/reorder-columns',
        { columnOrder: order },
        "Couldn't save the column order."
      ),
    []
  );

  // -- Render ---------------------------------------------------------------

  return (
    <BoardTable<Person>
      items={people}
      getItemId={(p) => p.id}
      builtinColumns={builtinColumns}
      customColumns={columns}
      getCustomField={(p, name) => p.customFields[name] ?? ''}
      columnOrder={effectiveOrder}
      onUpdateField={handleUpdateField}
      onUpdateFields={handleUpdateFields}
      onDeleteItem={handleDeleteItem}
      onReorderColumns={handleReorderColumns}
      deleteConfirmMessage="Remove this person?"
      highlightId={highlightPersonId}
      onHighlightDone={onHighlightDone}
      tableClassName="network-table"
    />
  );
}
