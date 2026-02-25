import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';
import { generatePersonId, normalizeCheckboxValue } from '@/lib/network';
import type { Person, PersonStatus } from '@/lib/network';
import type { Column } from '@/lib/markdown';

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
  customFields?: Record<string, string>;
}

const VALID_STATUSES = new Set([
  'not-contacted',
  'reached-out',
  'waiting',
  'in-conversation',
  'paused',
]);

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows, mapping, newColumns } = (await request.json()) as {
      rows: string[][];
      mapping: string[];
      newColumns: ColumnDef[] | string[];
    };

    if (!rows || !mapping) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build a map of custom column types for normalization during import
    const customColTypes = new Map<string, ColumnDef>();

    // Add new custom columns that don't already exist
    const existingColNames = new Set(ctx.network.columns.map((c) => c.name));
    const columnsToAdd: Column[] = [];
    for (const colDef of newColumns || []) {
      const name = typeof colDef === 'string' ? colDef : colDef.name;
      const type = typeof colDef === 'string' ? 'text' : colDef.type;
      const options = typeof colDef === 'string' ? undefined : colDef.options;

      if (name) {
        customColTypes.set(name, { name, type, options });
        if (!existingColNames.has(name)) {
          const col: Column = { name, type };
          if (type === 'dropdown' && options?.length) col.options = options;
          columnsToAdd.push(col);
          existingColNames.add(name);
        }
      }
    }
    ctx.network.columns.push(...columnsToAdd);

    const customFieldDefaults: Record<string, string> = {};
    for (const col of ctx.network.columns) {
      customFieldDefaults[col.name] = col.type === 'checkbox' ? 'No' : '';
    }

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const data: ImportRow = { customFields: {} };

      for (let i = 0; i < mapping.length; i++) {
        const field = mapping[i];
        const value = (row[i] || '').trim();
        if (!value || field === 'skip') continue;

        if (
          field === 'name' ||
          field === 'company' ||
          field === 'role' ||
          field === 'linkedinUrl'
        ) {
          data[field] = value;
        } else if (field === 'status') {
          data.status = value;
        } else if (field.startsWith('custom:')) {
          const colName = field.slice(7);
          const colType = customColTypes.get(colName);
          data.customFields![colName] =
            colType?.type === 'checkbox' ? normalizeCheckboxValue(value) : value;
        }
      }

      if (!data.name && !data.company && !data.role) {
        skipped++;
        continue;
      }

      let status: PersonStatus = 'not-contacted';
      if (data.status) {
        const lower = data.status.toLowerCase().trim();
        if (VALID_STATUSES.has(lower)) {
          status = lower as PersonStatus;
        }
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

      ctx.network.people.push(person);
      imported++;
    }

    // Initialize new custom fields on existing people
    for (const col of columnsToAdd) {
      for (const person of ctx.network.people) {
        if (!(col.name in person.customFields)) {
          person.customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
        }
      }
    }

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ imported, skipped });
  } catch (error) {
    console.error('Bulk add people error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import people' },
      { status: 500 }
    );
  }
}
