import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';
import { PERSON_STATUSES } from '@/lib/network';

export const runtime = 'nodejs';

interface FieldUpdate {
  field: string;
  value: string;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { personId, fields } = (await request.json()) as {
      personId: string;
      fields: FieldUpdate[];
    };

    if (!personId) {
      return NextResponse.json({ error: 'personId is required' }, { status: 400 });
    }

    const person = ctx.network.people.find((p) => p.id === personId);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    for (const { field, value } of fields) {
      if (field === 'status') {
        if (!PERSON_STATUSES.includes(value as (typeof PERSON_STATUSES)[number])) {
          return NextResponse.json(
            { error: `Status must be one of: ${PERSON_STATUSES.join(', ')}` },
            { status: 400 }
          );
        }
        person.status = value as (typeof PERSON_STATUSES)[number];
      } else if (field === 'name') {
        person.name = value;
      } else if (field === 'linkedinUrl') {
        person.linkedinUrl = value;
      } else if (field === 'company') {
        person.company = value;
      } else if (field === 'role') {
        person.role = value;
      } else if (field === 'lastContacted') {
        person.lastContacted = value || null;
      } else if (field === 'linkedJobIds') {
        try {
          person.linkedJobIds = JSON.parse(value);
        } catch {
          return NextResponse.json({ error: 'Invalid linkedJobIds format' }, { status: 400 });
        }
      } else {
        const col = ctx.network.columns.find((c) => c.name === field);
        if (col?.type === 'checkbox' && value !== 'Yes' && value !== 'No') {
          return NextResponse.json({ error: `${field} must be Yes or No` }, { status: 400 });
        }
        if (col?.type === 'dropdown' && col.options && !col.options.includes(value)) {
          return NextResponse.json(
            { error: `${field} must be one of: ${col.options.join(', ')}` },
            { status: 400 }
          );
        }
        person.customFields[field] = value;
      }
    }

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Update person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update person' },
      { status: 500 }
    );
  }
}
