import * as cheerio from 'cheerio';

export interface FetchPageResult {
  finalUrl: string;
  title: string | null;
  text: string;
  fetchedAt: string;
  fetchError?: string;
  errorType?: 'bot_protection' | 'http_error' | 'empty_content' | 'network_error';
}

// Known bot protection patterns
const BOT_PROTECTION_PATTERNS = [
  'Just a moment...',
  'Attention Required',
  'Access denied',
  'Please verify you are a human',
  'Checking your browser',
];

function detectBotProtection(html: string, title: string | null): boolean {
  // Check title patterns
  for (const pattern of BOT_PROTECTION_PATTERNS) {
    if (title?.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for Cloudflare challenge scripts
  if (html.includes('cf_chl_opt') || html.includes('/cdn-cgi/challenge-platform')) {
    return true;
  }

  // Check for common bot protection indicators
  if (html.includes('Enable JavaScript and cookies to continue')) {
    return true;
  }

  // PerimeterX
  if (html.includes('_pxhd') || html.includes('perimeterx')) {
    return true;
  }

  // DataDome
  if (html.includes('datadome')) {
    return true;
  }

  return false;
}

function getFriendlyHttpError(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return 'This page requires login or blocked our request. Try using manual entry.';
    case 404:
      return 'This job posting may have been removed or the link is broken.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The job site is having issues right now. Try again later or use manual entry.';
    default:
      return 'Could not load this page. Try using manual entry instead.';
  }
}

function getFriendlyNetworkError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The page took too long to load. Try again or use manual entry.';
  }
  if (lower.includes('network') || lower.includes('connect') || lower.includes('dns')) {
    return 'Could not connect to the site. Check your internet or try manual entry.';
  }
  if (lower.includes('ssl') || lower.includes('certificate')) {
    return 'Security issue with this site. Try using manual entry instead.';
  }
  return 'Something went wrong loading this page. Try using manual entry.';
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchPage(url: string): Promise<FetchPageResult> {
  const fetchedAt = new Date().toISOString();
  const isLinkedInJob = url.includes('linkedin.com/jobs/view/');

  try {
    // For LinkedIn jobs, don't auto-follow redirects so we can detect expired jobs
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: isLinkedInJob ? 'manual' : 'follow',
    });

    // Check for LinkedIn expired job redirect
    if (
      isLinkedInJob &&
      (response.status === 301 ||
        response.status === 302 ||
        response.status === 303 ||
        response.status === 307 ||
        response.status === 308)
    ) {
      const redirectUrl = response.headers.get('location') || '';
      if (redirectUrl.includes('expired_jd_redirect') || redirectUrl.includes('/jobs/search')) {
        return {
          finalUrl: redirectUrl || url,
          title: null,
          text: '',
          fetchedAt,
          fetchError: 'This LinkedIn job posting has expired. Please use manual entry instead.',
          errorType: 'http_error',
        };
      }
      // If it's a different redirect, follow it manually
      return fetchPage(
        redirectUrl.startsWith('http') ? redirectUrl : `https://www.linkedin.com${redirectUrl}`
      );
    }

    if (!response.ok) {
      return {
        finalUrl: response.url || url,
        title: null,
        text: '',
        fetchedAt,
        fetchError: getFriendlyHttpError(response.status),
        errorType: 'http_error',
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title (prefer og:title over <title>)
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    const htmlTitle = $('title').first().text().trim();
    const title = ogTitle || htmlTitle || null;

    // Check for bot protection before processing
    if (detectBotProtection(html, title)) {
      return {
        finalUrl: response.url || url,
        title,
        text: '',
        fetchedAt,
        fetchError: 'This site blocks automatic access. Please use manual entry instead.',
        errorType: 'bot_protection',
      };
    }

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
              const loc = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
                .filter(Boolean)
                .join(', ');
              if (loc) parts.push(`Location: ${loc}`);
            }
            if (data.hiringOrganization?.name)
              parts.push(`Company: ${data.hiringOrganization.name}`);
            if (data.baseSalary) {
              const salary = data.baseSalary;
              if (salary.value) {
                const salaryStr =
                  typeof salary.value === 'object'
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
        fetchError:
          'Could not find job details on this page. It may require login or use manual entry.',
        errorType: 'empty_content',
      };
    }

    return {
      finalUrl: response.url || url,
      title,
      text,
      fetchedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      finalUrl: url,
      title: null,
      text: '',
      fetchedAt,
      fetchError: getFriendlyNetworkError(message),
      errorType: 'network_error',
    };
  }
}
