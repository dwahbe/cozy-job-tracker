'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { autoMapColumns, inferColumnType } from '@/lib/network';
import type { MappableField, InferredColumnType } from '@/lib/network';

interface ManualPerson {
  name: string;
  linkedinUrl: string;
  company: string;
  role: string;
}

const emptyManualPerson: ManualPerson = {
  name: '',
  linkedinUrl: '',
  company: '',
  role: '',
};

const FIELD_OPTIONS: { value: MappableField | 'custom'; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'company', label: 'Company' },
  { value: 'role', label: 'Role' },
  { value: 'linkedinUrl', label: 'LinkedIn URL' },
  { value: 'status', label: 'Status' },
  { value: 'custom', label: 'Custom column' },
  { value: 'skip', label: 'Skip' },
];

const CUSTOM_TYPE_OPTIONS: InferredColumnType['type'][] = ['text', 'checkbox', 'dropdown', 'date'];

function parseDropdownOptions(value: string): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(trimmed);
  }

  return options;
}

type ImportStep = 'url' | 'mapping' | 'importing' | 'done';

interface AddPersonFormProps {
  onManualAdd?: () => void;
}

export function AddPersonForm({ onManualAdd }: AddPersonFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'manual' | 'import'>('manual');

  // Manual mode state
  const [manualPerson, setManualPerson] = useState<ManualPerson>(emptyManualPerson);
  const [adding, setAdding] = useState(false);

  // Import mode state
  const [sheetUrl, setSheetUrl] = useState('');
  const [importStep, setImportStep] = useState<ImportStep>('url');
  const [fetching, setFetching] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<(MappableField | 'custom')[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(
    null
  );
  const [customTypes, setCustomTypes] = useState<Record<number, InferredColumnType>>({});
  const [dropdownOptionDrafts, setDropdownOptionDrafts] = useState<Record<number, string>>({});

  const [error, setError] = useState<string | null>(null);

  const switchMode = (newMode: 'manual' | 'import') => {
    setMode(newMode);
    setError(null);
    if (newMode === 'import') {
      setImportStep('url');
      setHeaders([]);
      setRows([]);
      setMapping([]);
      setImportResult(null);
      setCustomTypes({});
      setDropdownOptionDrafts({});
    }
  };

  // ---- Manual mode ----

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPerson.name) return;

    setAdding(true);
    setError(null);

    try {
      const res = await fetch('/api/network/add-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualPerson.name,
          linkedinUrl: manualPerson.linkedinUrl,
          company: manualPerson.company,
          role: manualPerson.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add person');
        return;
      }

      setManualPerson(emptyManualPerson);
      onManualAdd?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAdding(false);
    }
  };

  // ---- Import mode ----

  const handleFetchSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    setFetching(true);
    setError(null);

    try {
      const res = await fetch('/api/network/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch sheet');
        return;
      }

      setHeaders(data.headers);
      setRows(data.rows);
      setTotalRows(data.totalRows);
      const autoMapped = autoMapColumns(data.headers);
      setMapping(autoMapped);

      const inferred: Record<number, InferredColumnType> = {};
      const initialDropdownDrafts: Record<number, string> = {};
      for (let i = 0; i < data.headers.length; i++) {
        const inferredType = inferColumnType(data.rows.map((row: string[]) => row[i] || ''));
        inferred[i] = inferredType;
        if (inferredType.type === 'dropdown' && inferredType.options) {
          initialDropdownDrafts[i] = inferredType.options.join(', ');
        }
      }
      setCustomTypes(inferred);
      setDropdownOptionDrafts(initialDropdownDrafts);

      setImportStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setFetching(false);
    }
  };

  const updateMapping = (index: number, value: MappableField | 'custom') => {
    setMapping((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const updateCustomType = (index: number, type: InferredColumnType['type']) => {
    const previous = customTypes[index];
    const inferredOptions =
      previous?.options?.length || type !== 'dropdown'
        ? previous?.options
        : inferColumnType(rows.map((row) => row[index] || '')).options;

    setCustomTypes((prev) => ({
      ...prev,
      [index]:
        type === 'dropdown'
          ? { type, options: inferredOptions || [] }
          : { type, ...(previous?.options ? { options: previous.options } : {}) },
    }));

    if (type === 'dropdown') {
      setDropdownOptionDrafts((prev) => ({
        ...prev,
        [index]: prev[index] ?? (inferredOptions || []).join(', '),
      }));
    }
  };

  const handleImport = async () => {
    setImportStep('importing');
    setError(null);

    const newColumns: {
      name: string;
      type: 'text' | 'checkbox' | 'dropdown' | 'date';
      options?: string[];
    }[] = [];
    const finalMapping: string[] = mapping.map((m, i) => {
      if (m === 'custom') {
        const ct = customTypes[i] || { type: 'text' };
        newColumns.push({
          name: headers[i],
          type: ct.type,
          ...(ct.type === 'dropdown' && ct.options ? { options: ct.options } : {}),
        });
        return `custom:${headers[i]}`;
      }
      return m;
    });

    try {
      const res = await fetch('/api/network/bulk-add-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers,
          rows,
          mapping: finalMapping,
          newColumns,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to import');
        setImportStep('mapping');
        return;
      }

      setImportResult(data);
      setImportStep('done');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setImportStep('mapping');
    }
  };

  const emptyColumns = new Set(
    headers.map((_, i) => i).filter((i) => rows.every((row) => !row[i]?.trim()))
  );
  const visibleHeaders = headers
    .map((header, i) => ({ header, index: i }))
    .filter(({ index }) => !emptyColumns.has(index));
  const customColumnsToConfigure = visibleHeaders.filter(
    ({ index }) => mapping[index] === 'custom'
  );
  const mappedCount = mapping.filter((m, i) => m !== 'skip' && !emptyColumns.has(i)).length;
  const previewRows = rows.slice(0, 3);

  // ---- Render ----

  return (
    <div className="mb-8 card p-7">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Add people</h2>
          <p className="muted text-sm">
            {mode === 'manual'
              ? 'Enter their details manually.'
              : importStep === 'done'
                ? `Import complete.`
                : 'Import contacts from a Google Sheet.'}
          </p>
        </div>
        {importStep === 'mapping' || importStep === 'importing' ? (
          <button
            type="button"
            onClick={() => {
              setImportStep('url');
              setError(null);
            }}
            className="p-1.5 rounded hover:bg-black/5 transition-colors text-muted-3 hover:text-foreground shrink-0 self-start"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : (
          <div className="view-toggle shrink-0 self-start">
            <button
              type="button"
              onClick={() => switchMode('manual')}
              className={`view-toggle-btn ${mode === 'manual' ? 'active' : ''}`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => switchMode('import')}
              className={`view-toggle-btn ${mode === 'import' ? 'active' : ''}`}
            >
              Import
            </button>
          </div>
        )}
      </div>

      {mode === 'manual' ? (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={manualPerson.name}
                onChange={(e) => setManualPerson({ ...manualPerson, name: e.target.value })}
                placeholder="e.g. Jane Smith"
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Company</label>
              <input
                type="text"
                value={manualPerson.company}
                onChange={(e) => setManualPerson({ ...manualPerson, company: e.target.value })}
                placeholder="e.g. Acme Inc"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <input
                type="text"
                value={manualPerson.role}
                onChange={(e) => setManualPerson({ ...manualPerson, role: e.target.value })}
                placeholder="e.g. Senior Engineer"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">LinkedIn URL</label>
              <input
                type="text"
                value={manualPerson.linkedinUrl}
                onChange={(e) => setManualPerson({ ...manualPerson, linkedinUrl: e.target.value })}
                placeholder="linkedin.com/in/..."
                className="input w-full"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={adding || !manualPerson.name}
            className="btn btn-primary w-full"
          >
            {adding ? 'Adding...' : 'Add to network'}
          </button>
        </form>
      ) : (
        <>
          {/* Step 1: Paste URL */}
          {importStep === 'url' && (
            <form onSubmit={handleFetchSheet} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 10h18M3 14h18M9 4v16M15 4v16"
                  />
                </svg>
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="Paste Google Sheets URL..."
                  className="input w-full"
                  style={{ paddingLeft: '2.25rem' }}
                  disabled={fetching}
                />
              </div>
              <button
                type="submit"
                disabled={fetching || !sheetUrl.trim()}
                className="btn btn-primary whitespace-nowrap"
              >
                {fetching ? 'Loading...' : 'Fetch sheet'}
              </button>
            </form>
          )}

          {importStep === 'url' && (
            <p className="mt-3 text-xs muted">
              Make sure your sheet is shared as &ldquo;Anyone with the link can view&rdquo;.
            </p>
          )}

          {/* Step 2: Column mapping */}
          {importStep === 'mapping' && (
            <div>
              <p className="text-sm mb-3">
                <span className="font-medium">{totalRows} rows</span> found.{' '}
                <span className="muted">Map your columns to our fields:</span>
              </p>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-foreground/2">
                      <th className="text-left px-3 py-2 font-medium muted">Sheet column</th>
                      <th className="text-left px-3 py-2 font-medium muted">Maps to</th>
                      <th className="text-left px-3 py-2 font-medium muted">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHeaders.map(({ header, index: i }) => {
                      const samples = previewRows.map((row) => row[i]?.trim()).filter(Boolean);
                      return (
                        <tr key={i} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-2 font-medium">{header}</td>
                          <td className="px-3 py-2">
                            <select
                              value={mapping[i]}
                              onChange={(e) =>
                                updateMapping(i, e.target.value as MappableField | 'custom')
                              }
                              className="input text-sm py-1 w-full max-w-[160px] cursor-pointer"
                            >
                              {FIELD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 muted truncate max-w-[200px]">
                            {samples.length > 0 ? samples.join(', ') : 'No data'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-foreground/1.5 p-3 min-h-[110px]">
                {customColumnsToConfigure.length === 0 ? (
                  <p className="text-sm muted">
                    Choose <span className="font-medium">Custom column</span> for a sheet column to
                    configure its type.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {customColumnsToConfigure.map(({ header, index }, editorIndex) => {
                      const customType = customTypes[index] || { type: 'text' };
                      return (
                        <div
                          key={index}
                          className={editorIndex > 0 ? 'pt-3 border-t border-border' : undefined}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <p className="text-sm">
                              Editing custom column: <span className="font-medium">{header}</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {CUSTOM_TYPE_OPTIONS.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => updateCustomType(index, t)}
                                  className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
                                    customType.type === t
                                      ? 'border-accent bg-accent-soft text-accent font-medium'
                                      : 'border-border text-muted-3 hover:text-foreground hover:border-foreground/20'
                                  }`}
                                >
                                  {t === 'text'
                                    ? 'Text'
                                    : t === 'checkbox'
                                      ? 'Checkbox'
                                      : t === 'dropdown'
                                        ? 'Dropdown'
                                        : 'Date'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {customType.type === 'dropdown' && (
                            <div className="mt-3">
                              <label className="block text-xs font-medium mb-1.5 muted">
                                Dropdown options (comma-separated)
                              </label>
                              <input
                                type="text"
                                value={
                                  dropdownOptionDrafts[index] ??
                                  customType.options?.join(', ') ??
                                  ''
                                }
                                onChange={(e) => {
                                  const draft = e.target.value;
                                  setDropdownOptionDrafts((prev) => ({ ...prev, [index]: draft }));
                                  setCustomTypes((prev) => ({
                                    ...prev,
                                    [index]: {
                                      type: 'dropdown',
                                      options: parseDropdownOptions(draft),
                                    },
                                  }));
                                }}
                                placeholder="e.g. Hot, Warm, Cold"
                                className="input w-full text-sm"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs muted">
                  {mappedCount} column{mappedCount !== 1 ? 's' : ''} mapped
                  {mapping.filter((m) => m === 'custom').length > 0 &&
                    ` (${mapping.filter((m) => m === 'custom').length} as custom)`}
                </p>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={mappedCount === 0}
                  className="btn btn-primary"
                >
                  Import {totalRows} {totalRows === 1 ? 'person' : 'people'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {importStep === 'importing' && (
            <div className="text-center py-8">
              <p className="text-sm muted">Importing {totalRows} people...</p>
            </div>
          )}

          {/* Step 4: Done */}
          {importStep === 'done' && importResult && (
            <div className="callout">
              <p>
                Imported <strong>{importResult.imported}</strong>{' '}
                {importResult.imported === 1 ? 'person' : 'people'}
                {importResult.skipped > 0 && (
                  <span className="muted"> ({importResult.skipped} empty rows skipped)</span>
                )}
                .
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="callout callout-error mt-4">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
