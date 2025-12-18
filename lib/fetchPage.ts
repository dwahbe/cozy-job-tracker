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

    // Extract title (prefer og:title over <title>)
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    const htmlTitle = $('title').first().text().trim();
    const title = ogTitle || htmlTitle || null;

    // Extract OpenGraph description (common for job sites)
    const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || '';

    // Extract JSON-LD structured data (used by Workday, Lever, Greenhouse, etc.)
    let jsonLdText = '';
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (jsonText) {
          const data = JSON.parse(jsonText);
          // Extract relevant fields from JobPosting schema
          if (data['@type'] === 'JobPosting') {
            const parts: string[] = [];
            if (data.title) parts.push(`Title: ${data.title}`);
            if (data.description) parts.push(`Description: ${data.description}`);
            if (data.employmentType) parts.push(`Employment Type: ${data.employmentType}`);
            if (data.datePosted) parts.push(`Date Posted: ${data.datePosted}`);
            if (data.jobLocation?.address) {
              const addr = data.jobLocation.address;
              const loc = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(', ');
              if (loc) parts.push(`Location: ${loc}`);
            }
            if (data.hiringOrganization?.name) parts.push(`Company: ${data.hiringOrganization.name}`);
            if (data.baseSalary) {
              const salary = data.baseSalary;
              if (salary.value) {
                const salaryStr = typeof salary.value === 'object'
                  ? `${salary.value.minValue || ''}-${salary.value.maxValue || ''} ${salary.currency || ''}`
                  : `${salary.value} ${salary.currency || ''}`;
                parts.push(`Salary: ${salaryStr}`);
              }
            }
            jsonLdText = parts.join('\n');
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    // Remove scripts, styles, and other non-content elements
    $('script, style, noscript, iframe, svg, nav, footer, header').remove();
    $('[style*="display:none"], [style*="display: none"], [hidden]').remove();

    // Get body text
    let bodyText = $('body').text();

    // Collapse whitespace
    bodyText = bodyText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Combine all extracted text, preferring structured data
    const textParts: string[] = [];
    if (jsonLdText) textParts.push(jsonLdText);
    if (ogDescription && ogDescription.length > 100) textParts.push(ogDescription);
    if (bodyText.length > 100) textParts.push(bodyText);

    const text = textParts.join('\n\n---\n\n');

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
