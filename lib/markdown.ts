/**
 * Type definitions for job tracking
 * (Legacy markdown parsing functions removed after KV migration)
 */

export interface Column {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'date';
  options?: string[];
  optionColors?: Record<string, string>; // option value -> color key (e.g. "High" -> "red")
}

export interface ParsedJob {
  id: string;
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
