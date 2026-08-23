import { NextRequest, NextResponse } from 'next/server';
import { outcomeError, requireUserId, unauthorized } from '@/lib/api-auth';
import { withNetwork } from '@/lib/network-auth';
import { generatePersonId, normalizeCheckboxValue, parseFlexibleDate } from '@/lib/network';
import type { Person, PersonStatus } from '@/lib/network';
import { PERSON_STATUSES } from '@/lib/network';
import type { Column } from '@/lib/markdown';
import { addCustomColumn } from '@/lib/custom-column-utils';
import { MAX_IMPORT_ROWS, TEXT_FIELD_MAX } from '@/lib/limits';
import { getLinkError } from '@/lib/job-updates';
import { fail, ok } from '@/lib/outcome';

interface ColumnDef {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'date';
  options?: string[];
}

export const runtime = 'nodejs';

interface ImportRow {
  name?: string;
  company?: string;
  role?: string;
  linkedinUrl?: string;
  status?: string;
  customFields: Record<string, string>;
}

const clip = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value);

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
      // Add the new custom columns first (validated like any other column), remembering types
      // so imported values can be normalised.
      const columnTypes = new Map<string, ColumnDef>();
      const existing = new Set(network.columns.map((c) => c.name.toLowerCase()));
      for (const colDef of Array.isArray(newColumns) ? newColumns : []) {
        const def: ColumnDef | null =
          typeof colDef === 'string'
            ? { name: colDef, type: 'text' }
            : colDef && typeof colDef === 'object' && typeof colDef.name === 'string'
              ? { name: colDef.name, type: colDef.type, options: colDef.options }
              : null;
        if (!def || !def.name.trim()) continue;

        if (!existing.has(def.name.trim().toLowerCase())) {
          const column: Column = { name: def.name.trim(), type: def.type };
          if (def.type === 'dropdown' && def.options?.length) column.options = def.options;
          const added = addCustomColumn(network, network.people, column, 'network');
          if (!added.ok) return added;
          existing.add(added.value.name.toLowerCase());
        }
        const stored = network.columns.find(
          (c) => c.name.toLowerCase() === def.name.trim().toLowerCase()
        );
        if (stored) columnTypes.set(def.name, { name: stored.name, type: stored.type });
      }

      const columnByName = new Map(network.columns.map((c) => [c.name.toLowerCase(), c]));
      const customFieldDefaults: Record<string, string> = {};
      for (const col of network.columns) {
        customFieldDefaults[col.name] = col.type === 'checkbox' ? 'No' : '';
      }

      let imported = 0;
      let skipped = 0;

      for (const row of rows as unknown[][]) {
        const data: ImportRow = { customFields: {} };

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
            if (!column) continue;
            if (column.type === 'checkbox') {
              data.customFields[column.name] = normalizeCheckboxValue(value);
            } else if (column.type === 'date') {
              // Normalise spreadsheet spellings to ISO; anything else is kept as typed.
              data.customFields[column.name] = parseFlexibleDate(value) ?? value;
            } else if (column.type === 'dropdown') {
              // Unseen dropdown values become options so the import never silently drops data.
              const options = column.options ?? (column.options = []);
              const match = options.find((o) => o.toLowerCase() === value.toLowerCase());
              if (!match) options.push(value);
              data.customFields[column.name] = match ?? value;
            } else {
              data.customFields[column.name] = value;
            }
          }
        }

        if (!data.name && !data.company && !data.role) {
          skipped++;
          continue;
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
          customFields: { ...customFieldDefaults, ...data.customFields },
          createdAt: new Date().toISOString(),
        };

        network.people.push(person);
        imported++;
      }

      if (imported === 0 && columnTypes.size === 0) {
        return fail(400, 'Nothing to import — every row was empty');
      }
      return ok({ imported, skipped });
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
