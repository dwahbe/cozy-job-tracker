import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseCSV, extractGoogleSheetId } from '@/lib/network';
import { limited } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const MAX_ROWS = 200;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = await limited('sheet', session.user.id);
    if (blocked) return blocked;

    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const sheetId = extractGoogleSheetId(url);
    if (!sheetId) {
      return NextResponse.json(
        {
          error:
            'Could not find a Google Sheet ID in that URL. Make sure it looks like docs.google.com/spreadsheets/d/...',
        },
        { status: 400 }
      );
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    const res = await fetch(csvUrl, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: 'Sheet not found. Make sure the link is correct.' },
          { status: 422 }
        );
      }
      if (res.status === 403 || res.status === 401) {
        return NextResponse.json(
          {
            error:
              'This sheet is private. Set sharing to "Anyone with the link can view" and try again.',
          },
          { status: 422 }
        );
      }
      return NextResponse.json(
        {
          error: `Google returned status ${res.status}. Try again or check the sheet's sharing settings.`,
        },
        { status: 422 }
      );
    }

    const csvText = await res.text();
    if (!csvText.trim()) {
      return NextResponse.json({ error: 'The sheet appears to be empty.' }, { status: 422 });
    }

    const { headers, rows } = parseCSV(csvText);

    if (headers.length === 0) {
      return NextResponse.json({ error: 'No columns found in the sheet.' }, { status: 422 });
    }

    const trimmedRows = rows.slice(0, MAX_ROWS);

    return NextResponse.json({
      headers,
      rows: trimmedRows,
      totalRows: rows.length,
      truncated: rows.length > MAX_ROWS,
    });
  } catch (error) {
    console.error('Import sheet error:', error);
    const message = error instanceof Error ? error.message : 'Failed to import sheet';
    if (message.includes('timed out') || message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timed out. The sheet may be very large or Google is slow.' },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
