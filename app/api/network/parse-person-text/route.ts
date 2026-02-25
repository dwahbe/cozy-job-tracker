import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { extractPerson } from '@/lib/extractPerson';
import { validatePersonExtraction } from '@/lib/validatePersonExtraction';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const extraction = await extractPerson(text.trim(), null);
    const validated = validatePersonExtraction(extraction, text);

    return NextResponse.json({ person: validated });
  } catch (error) {
    console.error('Parse person text error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse text' },
      { status: 500 }
    );
  }
}
