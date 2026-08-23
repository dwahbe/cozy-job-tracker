import type { Column } from './markdown';
import { getOrderedColumnIds } from '@/lib/custom-column-utils';

// ============================================================
// Network data types
// ============================================================

export interface Interaction {
  id: string;
  type: 'reached-out' | 'met' | 'followed-up' | 'note';
  date: string; // ISO date
  note?: string;
}

export type PersonStatus =
  'not-contacted' | 'reached-out' | 'waiting' | 'in-conversation' | 'paused';

export const PERSON_STATUSES: PersonStatus[] = [
  'not-contacted',
  'reached-out',
  'waiting',
  'in-conversation',
  'paused',
];

export const STATUS_LABELS: Record<PersonStatus, string> = {
  'not-contacted': 'Not contacted',
  'reached-out': 'Reached out',
  waiting: 'Waiting',
  'in-conversation': 'In conversation',
  paused: 'Paused',
};

export interface Person {
  id: string;
  name: string;
  linkedinUrl: string;
  company: string;
  role: string;
  status: PersonStatus;
  lastContacted: string | null; // ISO date
  linkedJobIds: string[];
  interactions: Interaction[];
  customFields: Record<string, string>;
  createdAt: string; // ISO date
}

export interface TrashedPerson extends Person {
  deletedAt: string; // ISO date
}

export interface NetworkData {
  people: Person[];
  columns: Column[];
  columnOrder?: string[];
  showLinkedJobs?: boolean;
  trash?: TrashedPerson[];
  version?: number; // Bumped by every compare-and-set write (absent = 0 for older blobs)
}

// Built-in column IDs (always visible, not stored in columns[])
export const BUILTIN_NETWORK_COLUMNS = [
  '_name',
  '_linkedin',
  '_company',
  '_role',
  '_status',
  '_lastContacted',
] as const;

export type BuiltinNetworkColumnId = (typeof BUILTIN_NETWORK_COLUMNS)[number];

export const BUILTIN_NETWORK_COLUMN_LABELS: Record<BuiltinNetworkColumnId, string> = {
  _name: 'Name',
  _linkedin: 'LinkedIn / site',
  _company: 'Company',
  _role: 'Title',
  _status: 'Status',
  _lastContacted: 'Last contacted',
};

// Pre-built columns users can add with one click
export const PREBUILT_NETWORK_COLUMNS: Column[] = [
  {
    name: 'Relationship',
    type: 'dropdown',
    options: ['Friend', 'Ex-coworker', 'Recruiter', 'Alum', 'Other'],
  },
  { name: 'Strength', type: 'dropdown', options: ['Strong', 'Medium', 'Weak'] },
  { name: 'Next action', type: 'text' },
  { name: 'Follow-up date', type: 'text' },
  { name: 'Notes', type: 'text' },
  { name: 'Location', type: 'text' },
];

// Builtin columns that are hidden by default but can be toggled on
export const OPTIONAL_BUILTIN_COLUMNS: BuiltinNetworkColumnId[] = ['_lastContacted'];

// ============================================================
// Helpers
// ============================================================

/** A fresh, empty network — what a user has before their first write. */
export function createEmptyNetwork(): NetworkData {
  return { people: [], columns: [] };
}

export function generatePersonId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateInteractionId(): string {
  return `i-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createEmptyPerson(columns: Column[]): Person {
  const customFields: Record<string, string> = {};
  for (const col of columns) {
    customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
  }

  return {
    id: generatePersonId(),
    name: '',
    linkedinUrl: '',
    company: '',
    role: '',
    status: 'not-contacted',
    lastContacted: null,
    linkedJobIds: [],
    interactions: [],
    customFields,
    createdAt: new Date().toISOString(),
  };
}

export function getNetworkColumnOrder(data: NetworkData): string[] {
  const enabledBuiltinIds = [
    '_name',
    '_company',
    '_role',
    '_status',
    '_linkedin',
    ...(data.columnOrder?.includes('_lastContacted') ? ['_lastContacted'] : []),
    ...(data.showLinkedJobs ? ['_linkedJobs'] : []),
  ];

  return getOrderedColumnIds(data.columnOrder, enabledBuiltinIds, data.columns);
}

/**
 * Extract LinkedIn username from a URL for display
 */
export function linkedinUsername(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const match = parsed.pathname.match(/\/in\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Prune network trash items older than 30 days. Returns true if any were removed.
 */
export function pruneNetworkTrash(data: NetworkData): boolean {
  if (!data.trash || data.trash.length === 0) return false;
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const before = data.trash.length;
  data.trash = data.trash.filter((p) => new Date(p.deletedAt).getTime() > cutoff);
  return data.trash.length !== before;
}

// ============================================================
// CSV parsing (RFC 4180 compliant for Google Sheets export)
// ============================================================

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const results: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current);
        current = '';
        if (row.some((c) => c.trim())) results.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }

  row.push(current);
  if (row.some((c) => c.trim())) results.push(row);

  if (results.length === 0) return { headers: [], rows: [] };
  return { headers: results[0].map((h) => h.trim()), rows: results.slice(1) };
}

// ============================================================
// Fuzzy column matching for imports
// ============================================================

export type MappableField = 'name' | 'company' | 'role' | 'linkedinUrl' | 'status' | 'skip';

const FIELD_ALIASES: Record<Exclude<MappableField, 'skip'>, string[]> = {
  name: ['name', 'full name', 'person', 'contact', 'contact name', 'first name'],
  company: ['company', 'organization', 'org', 'employer', 'company name'],
  role: ['role', 'title', 'job title', 'headline', 'position', 'job'],
  linkedinUrl: ['linkedin', 'linkedin url', 'profile url', 'linkedin profile', 'url', 'link'],
  status: ['status', 'stage'],
};

export function autoMapColumns(headers: string[]): MappableField[] {
  const used = new Set<MappableField>();

  return headers.map((header) => {
    const lower = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
      Exclude<MappableField, 'skip'>,
      string[],
    ][]) {
      if (used.has(field)) continue;
      if (aliases.some((a) => lower === a || lower.includes(a))) {
        used.add(field);
        return field;
      }
    }
    return 'skip';
  });
}

const CHECKBOX_PATTERNS = new Set([
  'yes',
  'no',
  'true',
  'false',
  'y',
  'n',
  '1',
  '0',
  '✓',
  '✗',
  'x',
  '',
]);

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function toIso(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || !date.toISOString().startsWith(iso) ? null : iso;
}

/**
 * Parse the date spellings that show up in spreadsheets into YYYY-MM-DD:
 * 2026-08-25, 2026/8/25, 8/25/2026 (US, Google Sheets' default), 25.8.2026 (when the first
 * number can't be a month), Aug 25, 2026, 25 Aug 2026, August 25 2026. Returns null otherwise.
 */
export function parseFlexibleDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  let m = v.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    // Month-first unless that can't be a month (e.g. 25/8/2026).
    return a > 12 && b <= 12 ? toIso(year, b, a) : toIso(year, a, b);
  }

  m = v.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/i);
  if (m) {
    const month = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    return month ? toIso(Number(m[3]), month, Number(m[2])) : null;
  }

  m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?\s+(\d{2,4})$/i);
  if (m) {
    const month = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    return month ? toIso(Number(m[3]), month, Number(m[1])) : null;
  }

  return null;
}

export interface InferredColumnType {
  type: 'text' | 'checkbox' | 'dropdown' | 'date';
  options?: string[];
}

export function inferColumnType(values: string[]): InferredColumnType {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return { type: 'text' };

  // Checkbox: 80%+ values match yes/no/true/false patterns
  const checkboxCount = nonEmpty.filter((v) => CHECKBOX_PATTERNS.has(v.toLowerCase())).length;
  if (checkboxCount / nonEmpty.length >= 0.8) return { type: 'checkbox' };

  // Date: only when every value parses — a single stray value makes it a text column, since
  // date cells can't hold the unparseable ones.
  if (nonEmpty.every((v) => parseFlexibleDate(v) !== null)) return { type: 'date' };

  // Dropdown: <=8 unique values (case-insensitive dedup, keep first casing)
  const seen = new Map<string, string>();
  for (const v of nonEmpty) {
    const key = v.toLowerCase();
    if (!seen.has(key)) seen.set(key, v);
  }
  if (seen.size <= 8 && nonEmpty.length >= 3) {
    return { type: 'dropdown', options: [...seen.values()] };
  }

  return { type: 'text' };
}

export function normalizeCheckboxValue(value: string): string {
  const lower = value.trim().toLowerCase();
  return ['yes', 'true', 'y', '1', '✓'].includes(lower) ? 'Yes' : 'No';
}

export function extractGoogleSheetId(url: string): string | null {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
