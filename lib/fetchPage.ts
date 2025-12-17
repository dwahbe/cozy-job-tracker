import * as cheerio from 'cheerio';

export interface FetchPageResult {
  finalUrl: string;
  title: string | null;
  text: string;
  fetchedAt: string;
  fetchError?: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchPage(url: string): Promise<FetchPageResult> {
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        finalUrl: response.url || url,
        title: null,
        text: '',
        fetchedAt,
        fetchError: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('title').first().text().trim() || null;

    // Remove scripts, styles, and other non-content elements
    $('script, style, noscript, iframe, svg, nav, footer, header').remove();
    $('[style*="display:none"], [style*="display: none"], [hidden]').remove();

    // Get body text
    let text = $('body').text();

    // Collapse whitespace
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Check if content seems gated/empty
    if (text.length < 100) {
      return {
        finalUrl: response.url || url,
        title,
        text,
        fetchedAt,
        fetchError: 'Content appears to be gated or empty',
      };
    }

    return {
      finalUrl: response.url || url,
      title,
      text,
      fetchedAt,
    };
  } catch (error) {
    return {
      finalUrl: url,
      title: null,
      text: '',
      fetchedAt,
      fetchError: error instanceof Error ? error.message : 'Unknown fetch error',
    };
  }
}
