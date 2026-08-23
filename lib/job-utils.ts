import type { ParsedJob } from './markdown';

export const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

/**
 * The scheme of a link ("https", "mailto", …), or null for a bare one ("example.com/jobs/1").
 * A leading host:port ("careers.acme.com:8443/jobs/1") is a bare link, not a scheme: schemes
 * don't contain dots unless "//" follows.
 */
export function linkScheme(link: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):(\/\/)?/i.exec(link.trim());
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  return match[2] || !scheme.includes('.') ? scheme : null;
}

/** href for a stored link: bare "example.com/jobs/1" gets https://, anything with a scheme is kept. */
export function toHref(link: string): string {
  const trimmed = link.trim();
  return linkScheme(trimmed) ? trimmed : `https://${trimmed}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr === 'rolling') return 'Rolling';
  // Anything that isn't a plain YYYY-MM-DD (older free-text values) is shown as typed.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return dateStr;
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const ordinal = (n: number) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };
  return `${month} ${day}${ordinal(day)} ${year}`;
}

export function statusColor(status: string): string {
  return (
    (
      {
        Saved: 'status-saved',
        Applied: 'status-applied',
        Interview: 'status-interview',
        Offer: 'status-offer',
        Rejected: 'status-rejected',
      } as Record<string, string>
    )[status] || 'status-saved'
  );
}

export function getFieldValue(job: ParsedJob, field: string): string {
  switch (field.toLowerCase()) {
    case 'status':
      return job.status;
    case 'title':
      return job.title;
    case 'company':
      return job.company;
    case 'link':
      return job.link || '';
    case 'location':
      return job.location || '';
    case 'employment type':
      return job.employmentType || '';
    case 'notes':
      return job.notes || '';
    case 'due date':
      return job.dueDate || '';
    default:
      return job.customFields[field] || '';
  }
}

export function applyFieldUpdate(job: ParsedJob, field: string, value: string): void {
  switch (field.toLowerCase()) {
    case 'status':
      job.status = value;
      break;
    case 'title':
      job.title = value;
      break;
    case 'company':
      job.company = value;
      break;
    case 'link':
      job.link = value;
      break;
    case 'location':
      job.location = value;
      break;
    case 'employment type':
      job.employmentType = value;
      break;
    case 'notes':
      job.notes = value;
      break;
    case 'due date':
      job.dueDate = value;
      break;
    default:
      job.customFields[field] = value;
  }
}
