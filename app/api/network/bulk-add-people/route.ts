import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { generatePersonId, normalizeCheckboxValue, parseFlexibleDate } from '@/lib/network';
import type { Person, PersonStatus } from '@/lib/network';
import { PERSON_STATUSES } from '@/lib/network';
import type { Column } from '@/lib/markdown';
import { addCustomColumn } from '@/lib/custom-column-utils';
import {
  CUSTOM_TEXT_MAX,
  DROPDOWN_OPTION_MAX,
  MAX_DROPDOWN_OPTIONS,
  MAX_IMPORT_ROWS,
  TEXT_FIELD_MAX,
} from '@/lib/limits';
import { getLinkError } from '@/lib/job-updates';
import { ok, unchanged } from '@/lib/outcome';

export const runtime = 'nodejs';

interface ImportRow {
  name?: string;
  company?: string;
  role?: string;
  linkedinUrl?: string;
  status?: string;
  /** Raw custom-column cells; normalised (and stored) only for rows that are imported. */
  custom: { column: Column; value: string }[];
}

const clip = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value);

/**
 * The value to store for a custom cell, normalised to the column's type, or null when it can't
 * be stored as typed (free text in a date column, a dropdown value that doesn't fit within the
 * column's option limits). Unseen dropdown values become options so the import doesn't silently
 * drop data — up to MAX_DROPDOWN_OPTIONS, the same cap the column editor enforces.
 */
function importCustomValue(column: Column, value: string): string | null {
  switch (column.type) {
    case 'checkbox':
      return normalizeCheckboxValue(value);
    case 'date':
      return parseFlexibleDate(value);
    case 'dropdown': {
      const options = column.options ?? (column.options = []);
      const match = options.find((o) => o.toLowerCase() === value.toLowerCase());
      if (match) return match;
      if (value.length > DROPDOWN_OPTION_MAX || options.length >= MAX_DROPDOWN_OPTIONS) return null;
      options.push(value);
      return value;
    }
    default:
      return clip(value, CUSTOM_TEXT_MAX);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const { rows, mapping, newColumns } = (body ?? {}) as {
      rows?: unknown;
      mapping?: unknown;
      newColumns?: unknown;
    };

    if (
      !Array.isArray(rows) ||
      !Array.isArray(mapping) ||
      !mapping.every((m) => typeof m === 'string') ||
      !rows.every((row) => Array.isArray(row))
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Import up to ${MAX_IMPORT_ROWS} rows at a time` },
        { status: 400 }
      );
    }

    const result = await withNetwork(userId, (network) => {
      // Add the new custom columns first (validated like any other column).
      let columnsAdded = false;
      const existing = new Set(network.columns.map((c) => c.name.toLowerCase()));
      for (const colDef of Array.isArray(newColumns) ? newColumns : []) {
        const column: Column | null =
          typeof colDef === 'string'
            ? { name: colDef, type: 'text' }
            : colDef && typeof colDef === 'object' && typeof colDef.name === 'string'
              ? {
                  name: colDef.name,
                  type: colDef.type,
                  ...(colDef.type === 'dropdown' && colDef.options?.length
                    ? { options: colDef.options }
                    : {}),
                }
              : null;
        if (!column || !column.name.trim() || existing.has(column.name.trim().toLowerCase())) {
          continue;
        }
        const added = addCustomColumn(network, network.people, column, 'network');
        if (!added.ok) return added;
        existing.add(added.value.name.toLowerCase());
        columnsAdded = true;
      }

      const columnByName = new Map(network.columns.map((c) => [c.name.toLowerCase(), c]));
      const customFieldDefaults: Record<string, string> = {};
      for (const col of network.columns) {
        customFieldDefaults[col.name] = col.type === 'checkbox' ? 'No' : '';
      }

      let imported = 0;
      let skipped = 0;
      let dropped = 0; // custom cells left blank because they didn't fit their column

      for (const row of rows as unknown[][]) {
        const data: ImportRow = { custom: [] };

        for (let i = 0; i < mapping.length; i++) {
          const field = mapping[i] as string;
          const raw = row[i];
          const value = typeof raw === 'string' ? raw.trim() : '';
          if (!value || field === 'skip') continue;

          if (field === 'name' || field === 'company' || field === 'role') {
            data[field] = clip(value, TEXT_FIELD_MAX);
          } else if (field === 'linkedinUrl') {
            if (!getLinkError(value)) data.linkedinUrl = value;
          } else if (field === 'status') {
            data.status = value;
          } else if (field.startsWith('custom:')) {
            const column = columnByName.get(field.slice(7).trim().toLowerCase());
            if (column) data.custom.push({ column, value });
          }
        }

        if (!data.name && !data.company && !data.role) {
          skipped++;
          continue;
        }

        // Only rows that are actually imported get to touch the columns (dropdown options).
        const customFields = { ...customFieldDefaults };
        for (const { column, value } of data.custom) {
          const stored = importCustomValue(column, value);
          if (stored === null) dropped++;
          else customFields[column.name] = stored;
        }

        let status: PersonStatus = 'not-contacted';
        if (data.status) {
          const lower = data.status.toLowerCase().trim();
          if ((PERSON_STATUSES as string[]).includes(lower)) status = lower as PersonStatus;
        }

        const person: Person = {
          id: generatePersonId(),
          name: data.name || '',
          linkedinUrl: data.linkedinUrl || '',
          company: data.company || '',
          role: data.role || '',
          status,
          lastContacted: null,
          linkedJobIds: [],
          interactions: [],
          customFields,
          createdAt: new Date().toISOString(),
        };

        network.people.push(person);
        imported++;
      }

      const summary = { imported, skipped, dropped };
      return imported > 0 || columnsAdded ? ok(summary) : unchanged(summary);
    });
    if (!result.ok) return outcomeError(result);

    return NextResponse.json(result.value);
  } catch (error) {
    console.error('Bulk add people error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import people' },
      { status: 500 }
    );
  }
}
