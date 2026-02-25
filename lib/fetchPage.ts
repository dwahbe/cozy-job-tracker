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

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECT_DEPTH = 3;

function isPrivateUrl(urlString: string): boolean {
  try {
    const { hostname } = new URL(urlString);
    const host = hostname.replace(/^\[|\]$/g, '');

    if (host === 'localhost' || host === '::1') return true;

    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      const [a, b] = parts;
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
    }

    return false;
  } catch {
    return true;
  }
}

export async function fetchPage(url: string, depth = 0): Promise<FetchPageResult> {
  const fetchedAt = new Date().toISOString();

  if (isPrivateUrl(url)) {
    return {
      finalUrl: url,
      title: null,
      text: '',
      fetchedAt,
      fetchError: 'This URL points to an internal address and cannot be accessed.',
      errorType: 'network_error',
    };
  }

  if (depth > MAX_REDIRECT_DEPTH) {
    return {
      finalUrl: url,
      title: null,
      text: '',
      fetchedAt,
      fetchError: 'Too many redirects. Try using manual entry instead.',
      errorType: 'network_error',
    };
  }

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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
        redirectUrl.startsWith('http') ? redirectUrl : `https://www.linkedin.com${redirectUrl}`,
        depth + 1
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
      // Still include OG description for meta-tag extraction fallback
      const ogDesc = $('meta[property="og:description"]').attr('content')?.trim() || '';
      return {
        finalUrl: response.url || url,
        title,
        text: ogDesc,
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
        if (!jsonText) return;

        const data = JSON.parse(jsonText);

        // Find JobPosting from various JSON-LD structures
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let jobPosting: any = null;
        if (data['@type'] === 'JobPosting') {
          jobPosting = data;
        } else if (Array.isArray(data['@graph'])) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          jobPosting = data['@graph'].find((item: any) => item['@type'] === 'JobPosting');
        } else if (Array.isArray(data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          jobPosting = data.find((item: any) => item['@type'] === 'JobPosting');
        }

        if (jobPosting) {
          const parts: string[] = [];
          if (jobPosting.title) parts.push(`Title: ${jobPosting.title}`);
          if (jobPosting.description) parts.push(`Description: ${jobPosting.description}`);
          if (jobPosting.employmentType)
            parts.push(`Employment Type: ${jobPosting.employmentType}`);
          if (jobPosting.datePosted) parts.push(`Date Posted: ${jobPosting.datePosted}`);
          if (jobPosting.jobLocation?.address) {
            const addr = jobPosting.jobLocation.address;
            const loc = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .filter(Boolean)
              .join(', ');
            if (loc) parts.push(`Location: ${loc}`);
          }
          if (jobPosting.hiringOrganization?.name)
            parts.push(`Company: ${jobPosting.hiringOrganization.name}`);
          if (jobPosting.baseSalary) {
            const salary = jobPosting.baseSalary;
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
    if (ogDescription && ogDescription.length > 30) textParts.push(ogDescription);
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
