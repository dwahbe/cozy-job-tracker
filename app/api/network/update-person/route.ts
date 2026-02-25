import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';

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

    const builtinFields = new Set([
      'name',
      'linkedinUrl',
      'company',
      'role',
      'status',
      'lastContacted',
    ]);

    for (const { field, value } of fields) {
      if (builtinFields.has(field)) {
        (person as unknown as Record<string, unknown>)[field] = value;
      } else if (field === 'linkedJobIds') {
        person.linkedJobIds = JSON.parse(value);
      } else {
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
