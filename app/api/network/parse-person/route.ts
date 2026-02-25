import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchPage } from '@/lib/fetchPage';
import { extractPerson } from '@/lib/extractPerson';
import { validatePersonExtraction } from '@/lib/validatePersonExtraction';

export const runtime = 'nodejs';

/**
 * Fast extraction from LinkedIn title + OG tags (no OpenAI needed).
 * LinkedIn titles follow: "Name - Headline | LinkedIn"
 * OG description includes company, location, etc.
 */
function extractFromLinkedInMeta(
  title: string | null,
  text: string
): { name: string | null; role: string | null; company: string | null; location: string | null } {
  let name: string | null = null;
  let role: string | null = null;
  let company: string | null = null;
  let location: string | null = null;

  if (title) {
    const titleMatch = title.match(/^(.+?)\s*[-–—]\s*(.+?)\s*\|\s*LinkedIn$/i);
    if (titleMatch) {
      name = titleMatch[1].trim();
      role = titleMatch[2].trim();
    }
  }

  const locMatch = text.match(/Location:\s*([^\n·]+)/i);
  if (locMatch) location = locMatch[1].trim();

  const expMatch = text.match(/Experience:\s*([^\n·]+)/i);
  if (expMatch && !company) company = expMatch[1].trim();

  if (role && !company) {
    const atMatch = role.match(/(.+?)\s+at\s+(.+)/i);
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
    }

    const commaMatch = role.match(/(.+?),\s+(.+)/);
    if (commaMatch && !company) {
      role = commaMatch[1].trim();
      company = commaMatch[2].trim();
    }
  }

  return { name, role, company, location };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const pageResult = await fetchPage(url);

    if (pageResult.fetchError && pageResult.text.length === 0) {
      return NextResponse.json(
        { error: pageResult.fetchError, errorType: pageResult.errorType, person: null },
        { status: 422 }
      );
    }

    const isLinkedIn = url.includes('linkedin.com/in/');

    // Fast path: extract directly from LinkedIn meta tags (always available, no OpenAI needed)
    if (isLinkedIn && pageResult.title) {
      const meta = extractFromLinkedInMeta(pageResult.title, pageResult.text);
      if (meta.name) {
        // Try OpenAI for richer extraction, but fall back to meta if it fails
        try {
          const extraction = await extractPerson(
            pageResult.text,
            pageResult.title,
            pageResult.finalUrl
          );
          const validated = validatePersonExtraction(extraction, pageResult.text, pageResult.title);

          return NextResponse.json({
            person: {
              name: validated.name || meta.name,
              role: validated.role || meta.role,
              company: validated.company || meta.company,
              location: validated.location || meta.location,
              isVerified: validated.isVerified || !!meta.name,
            },
            fetchWarning: pageResult.fetchError,
          });
        } catch {
          // OpenAI failed, use meta extraction
          return NextResponse.json({
            person: { ...meta, isVerified: true },
            fetchWarning: 'Used profile metadata only',
          });
        }
      }
    }

    // General path: full OpenAI extraction
    const extraction = await extractPerson(pageResult.text, pageResult.title, pageResult.finalUrl);
    const validated = validatePersonExtraction(extraction, pageResult.text, pageResult.title);

    return NextResponse.json({
      person: validated,
      fetchWarning: pageResult.fetchError,
    });
  } catch (error) {
    console.error('Parse person error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse profile' },
      { status: 500 }
    );
  }
}
