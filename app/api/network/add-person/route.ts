import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';
import { generatePersonId } from '@/lib/network';
import type { Person, PersonStatus } from '@/lib/network';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      name = '',
      linkedinUrl = '',
      company = '',
      role = '',
      status = 'not-contacted',
      customFields = {},
    } = body;

    const customFieldsInit: Record<string, string> = {};
    for (const col of ctx.network.columns) {
      customFieldsInit[col.name] = col.type === 'checkbox' ? 'No' : '';
    }

    const person: Person = {
      id: generatePersonId(),
      name,
      linkedinUrl,
      company,
      role,
      status: status as PersonStatus,
      lastContacted: null,
      linkedJobIds: [],
      interactions: [],
      customFields: { ...customFieldsInit, ...customFields },
      createdAt: new Date().toISOString(),
    };

    ctx.network.people.unshift(person);
    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ personId: person.id });
  } catch (error) {
    console.error('Add person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add person' },
      { status: 500 }
    );
  }
}
