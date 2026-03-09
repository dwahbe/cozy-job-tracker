import type { ParsedJob } from './markdown';

export const STATUS_OPTIONS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr === 'rolling') return 'Rolling';
  const date = new Date(dateStr + 'T00:00:00');
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
