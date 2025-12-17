/**
 * Type definitions for job tracking
 * (Legacy markdown parsing functions removed after KV migration)
 */

export interface Column {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown';
  options?: string[];
}

export interface ParsedJob {
  title: string;
  company: string;
  link: string;
  location: string;
  employmentType: string;
  notes: string;
  status: string;
  dueDate: string;
  parsedOn: string;
  verified: string;
  customFields: Record<string, string>;
}
