import * as cheerio from 'cheerio';
import { unsafeUrlReason } from '@/lib/safe-url';

export interface StructuredJobData {
  title?: string;
  company?: string;
  location?: string;
  employmentType?: string;
  dueDate?: string; // YYYY-MM-DD
}

export interface FetchPageResult {
  finalUrl: string;
  title: string | null;
  text: string;
  fetchedAt: string;
  fetchError?: string;
  errorType?: 'bot_protection' | 'http_error' | 'empty_content' | 'network_error';
  structured?: StructuredJobData;
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: 'Full-time',
  FULLTIME: 'Full-time',
  'FULL-TIME': 'Full-time',
  PART_TIME: 'Part-time',
  PARTTIME: 'Part-time',
  'PART-TIME': 'Part-time',
  CONTRACTOR: 'Contract',
  CONTRACT: 'Contract',
  TEMPORARY: 'Temporary',
  INTERN: 'Internship',
  INTERNSHIP: 'Internship',
  VOLUNTEER: 'Volunteer',
  PER_DIEM: 'Per diem',
};

function normalizeEmploymentType(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const upper = value.toUpperCase().trim();
    return EMPLOYMENT_TYPE_MAP[upper];
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const result = normalizeEmploymentType(v);
      if (result) return result;
    }
  }
  return undefined;
}

function extractIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAddress(loc: any): string | null {
  const addr = loc?.address;
  if (!addr) return null;
  const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(
    (p) => typeof p === 'string' && p.trim()
  );
  return parts.length ? parts.join(', ') : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractStructuredLocation(jobLocation: any): string | undefined {
  const locs = Array.isArray(jobLocation) ? jobLocation : [jobLocation];
  const formatted = locs.map(formatAddress).filter((s): s is string => s !== null);
  if (!formatted.length) return undefined;
  const unique = Array.from(new Set(formatted));
  return unique.join(' / ');
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
const MAX_REDIRECTS = 3;
// Job pages are small; anything past this is dropped rather than buffered.
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// No explicit Accept-Encoding: the runtime negotiates gzip/br and decodes transparently.
const FETCH_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

type ErrorType = NonNullable<FetchPageResult['errorType']>;
type FetchFailure = { finalUrl: string; fetchError: string; errorType: ErrorType };
type Fetched = { finalUrl: string; response: Response };

function failure(finalUrl: string, fetchError: string, errorType: ErrorType): FetchFailure {
  return { finalUrl, fetchError, errorType };
}

/**
 * Fetch with redirects followed by hand (at most MAX_REDIRECTS hops) so that every hop —
 * not just the first URL — is checked against the private-address guard.
 */
async function fetchFollowingRedirects(url: string): Promise<Fetched | FetchFailure> {
  let currentUrl = url;

  for (let hop = 0; ; hop++) {
    const reason = unsafeUrlReason(currentUrl);
    if (reason) return failure(currentUrl, reason, 'network_error');

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        headers: FETCH_HEADERS,
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return failure(currentUrl, getFriendlyNetworkError(message), 'network_error');
    }

    if (!REDIRECT_STATUSES.has(response.status)) return { finalUrl: currentUrl, response };

    const location = response.headers.get('location') ?? '';
    await response.body?.cancel();

    // LinkedIn sends expired postings to a search page instead of answering 404.
    if (
      currentUrl.includes('linkedin.com/jobs/view/') &&
      (location.includes('expired_jd_redirect') || location.includes('/jobs/search'))
    ) {
      return failure(
        location || currentUrl,
        'This LinkedIn job posting has expired. Please use manual entry instead.',
        'http_error'
      );
    }

    // A redirect without a Location header has nowhere to go.
    if (!location) return failure(currentUrl, getFriendlyHttpError(response.status), 'http_error');

    if (hop >= MAX_REDIRECTS) {
      return failure(
        currentUrl,
        'Too many redirects. Try using manual entry instead.',
        'network_error'
      );
    }

    try {
      currentUrl = new URL(location, currentUrl).toString();
    } catch {
      return failure(currentUrl, getFriendlyHttpError(response.status), 'http_error');
    }
  }
}

/** Read at most `maxBytes` of the body as UTF-8; the remainder is discarded. */
async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let text = '';
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      const keep = value.byteLength - (received - maxBytes);
      text += decoder.decode(value.subarray(0, keep), { stream: true });
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function fetchPage(url: string): Promise<FetchPageResult> {
  const fetchedAt = new Date().toISOString();

  const fetched = await fetchFollowingRedirects(url);
  if (!('response' in fetched)) {
    return { ...fetched, title: null, text: '', fetchedAt };
  }
  const { response, finalUrl } = fetched;

  try {
    if (!response.ok) {
      await response.body?.cancel();
      return {
        finalUrl,
        title: null,
        text: '',
        fetchedAt,
        fetchError: getFriendlyHttpError(response.status),
        errorType: 'http_error',
      };
    }

    const html = await readBodyCapped(response, MAX_BODY_BYTES);
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
        finalUrl,
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
    let structured: StructuredJobData | undefined;
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
          const collected: StructuredJobData = {};
          const parts: string[] = [];

          if (typeof jobPosting.title === 'string' && jobPosting.title.trim()) {
            collected.title = jobPosting.title.trim();
            parts.push(`Title: ${collected.title}`);
          }

          const company =
            typeof jobPosting.hiringOrganization === 'string'
              ? jobPosting.hiringOrganization
              : jobPosting.hiringOrganization?.name;
          if (typeof company === 'string' && company.trim()) {
            collected.company = company.trim();
            parts.push(`Company: ${collected.company}`);
          }

          const loc = extractStructuredLocation(jobPosting.jobLocation);
          if (loc) {
            collected.location = loc;
            parts.push(`Location: ${loc}`);
          }

          const empType = normalizeEmploymentType(jobPosting.employmentType);
          if (empType) {
            collected.employmentType = empType;
            parts.push(`Employment Type: ${empType}`);
          }

          const validThrough = extractIsoDate(jobPosting.validThrough);
          if (validThrough) {
            collected.dueDate = validThrough;
            parts.push(`Application Deadline: ${validThrough}`);
          }

          if (jobPosting.description) parts.push(`Description: ${jobPosting.description}`);
          if (jobPosting.datePosted) parts.push(`Date Posted: ${jobPosting.datePosted}`);

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
          if (Object.keys(collected).length > 0) structured = collected;
          return false;
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
        finalUrl,
        title,
        text,
        fetchedAt,
        fetchError:
          'Could not find job details on this page. It may require login or use manual entry.',
        errorType: 'empty_content',
      };
    }

    return {
      finalUrl,
      title,
      text,
      fetchedAt,
      ...(structured ? { structured } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      finalUrl,
      title: null,
      text: '',
      fetchedAt,
      fetchError: getFriendlyNetworkError(message),
      errorType: 'network_error',
    };
  }
}
