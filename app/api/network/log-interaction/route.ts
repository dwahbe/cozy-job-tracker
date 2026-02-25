import { NextRequest, NextResponse } from 'next/server';
import { resolveNetwork, saveNetworkAndRevalidate } from '@/lib/network-auth';
import { generateInteractionId } from '@/lib/network';
import type { Interaction } from '@/lib/network';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveNetwork();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { personId, type, note, followUpDate } = await request.json();

    if (!personId || !type) {
      return NextResponse.json({ error: 'personId and type are required' }, { status: 400 });
    }

    const validTypes = ['reached-out', 'met', 'followed-up', 'note'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 });
    }

    const person = ctx.network.people.find((p) => p.id === personId);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const interaction: Interaction = {
      id: generateInteractionId(),
      type,
      date: new Date().toISOString().split('T')[0],
      ...(note ? { note } : {}),
    };

    person.interactions.unshift(interaction);
    person.lastContacted = interaction.date;

    if (type !== 'note') {
      person.status = type === 'reached-out' ? 'reached-out' : 'in-conversation';
    }

    if (followUpDate) {
      person.customFields['Follow-up date'] = followUpDate;
    }

    await saveNetworkAndRevalidate(ctx);

    return NextResponse.json({ interactionId: interaction.id });
  } catch (error) {
    console.error('Log interaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to log interaction' },
      { status: 500 }
    );
  }
}
