import matter from 'gray-matter';
import type { ValidatedJob } from './validateExtraction';

export interface Column {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown';
  options?: string[];
}

export interface BoardData {
  title: string;
  columns: Column[];
  content: string;
  pin?: string; // bcrypt hash, only present if board is protected
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

/**
 * Parse a board markdown file into frontmatter data and content
 */
export function parseBoardFile(fileContent: string): BoardData {
  const { data, content } = matter(fileContent);
  return {
    title: data.title || 'Job Board',
    columns: data.columns || [],
    content,
    pin: data.pin, // undefined if not set
  };
}

/**
 * Parse jobs from markdown content
 */
export function parseJobsFromMarkdown(content: string, columns: Column[]): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  
  // Find the ## Saved section
  const savedMatch = content.match(/## Saved\s*\n([\s\S]*?)(?=\n## |$)/);
  if (!savedMatch) return jobs;
  
  const savedSection = savedMatch[1];
  
  // Split by job entries (start with "- **")
  const jobBlocks = savedSection.split(/\n(?=- \*\*)/);
  
  for (const block of jobBlocks) {
    if (!block.trim() || !block.startsWith('- **')) continue;
    
    const job = parseJobBlock(block, columns);
    if (job) jobs.push(job);
  }
  
  return jobs;
}

function parseJobBlock(block: string, columns: Column[]): ParsedJob | null {
  // Extract title and company from "- **Title — Company**"
  const headerMatch = block.match(/- \*\*(.+?) — (.+?)\*\*/);
  if (!headerMatch) return null;
  
  const [, title, company] = headerMatch;
  
  // Extract fields
  const getField = (name: string): string => {
    const regex = new RegExp(`- ${name}: (.*)`, 'i');
    const match = block.match(regex);
    return match ? match[1].trim() : '';
  };
  
  const customFields: Record<string, string> = {};
  for (const col of columns) {
    customFields[col.name] = getField(col.name);
  }
  
  return {
    title,
    company,
    link: getField('Link'),
    location: getField('Location'),
    employmentType: getField('Employment type'),
    notes: getField('Notes'),
    status: getField('Status'),
    dueDate: getField('Due date'),
    parsedOn: getField('Parsed on'),
    verified: getField('Verified'),
    customFields,
  };
}

/**
 * Format a job as a markdown block
 */
export function formatJobMarkdown(job: ValidatedJob, columns: Column[]): string {
  const title = job.title || 'Unknown Position';
  const company = job.company || 'Unknown Company';
  const location = job.location || 'Not listed';
  const employmentType = job.employment_type || 'Not listed';
  const notes = job.notes || '';
  const parsedOn = job.fetchedAt.split('T')[0];
  const verified = job.isVerified ? 'Yes' : 'No';
  
  let block = `- **${title} — ${company}**
  - Link: ${job.finalUrl}
  - Location: ${location}
  - Employment type: ${employmentType}
  - Notes: ${notes}
  - Status: Saved
  - Due date:`;
  
  // Add custom columns with default values
  for (const col of columns) {
    const defaultValue = col.type === 'checkbox' ? 'No' : '';
    block += `\n  - ${col.name}: ${defaultValue}`;
  }
  
  block += `
  - Parsed on: ${parsedOn}
  - Verified: ${verified}`;
  
  return block;
}

/**
 * Append a job block under the ## Saved section
 */
export function appendUnderSavedSection(content: string, jobBlock: string): string {
  // Check if ## Saved exists
  if (content.includes('## Saved')) {
    // Find the position right after "## Saved" and any existing content
    const savedIndex = content.indexOf('## Saved');
    const afterSaved = content.slice(savedIndex + 8); // Length of "## Saved"
    
    // Find the next section or end of file
    const nextSectionMatch = afterSaved.match(/\n## /);
    
    if (nextSectionMatch) {
      // Insert before the next section
      const insertIndex = savedIndex + 8 + nextSectionMatch.index!;
      return content.slice(0, insertIndex) + '\n\n' + jobBlock + content.slice(insertIndex);
    } else {
      // Append at the end
      return content.trimEnd() + '\n\n' + jobBlock;
    }
  } else {
    // Add ## Saved section at the end
    return content.trimEnd() + '\n\n## Saved\n\n' + jobBlock;
  }
}

/**
 * Update a field for a specific job identified by its link
 */
export function updateJobInMarkdown(
  content: string,
  jobLink: string,
  field: string,
  value: string
): string {
  // Find the job block by its link
  const linkPattern = `- Link: ${jobLink}`;
  const linkIndex = content.indexOf(linkPattern);
  
  if (linkIndex === -1) {
    throw new Error('Job not found');
  }
  
  // Find the start of this job block (go back to find "- **")
  let blockStart = content.lastIndexOf('- **', linkIndex);
  if (blockStart === -1) {
    throw new Error('Job block start not found');
  }
  
  // Find the end of this job block (next "- **" or end of section)
  let blockEnd = content.indexOf('\n- **', blockStart + 1);
  if (blockEnd === -1) {
    // Check for next section
    const nextSection = content.indexOf('\n## ', blockStart);
    blockEnd = nextSection === -1 ? content.length : nextSection;
  }
  
  const jobBlock = content.slice(blockStart, blockEnd);
  
  // Update the field in the job block
  const fieldPattern = new RegExp(`(- ${escapeRegex(field)}: ).*`, 'i');
  
  let updatedBlock: string;
  if (fieldPattern.test(jobBlock)) {
    updatedBlock = jobBlock.replace(fieldPattern, `$1${value}`);
  } else {
    // Field doesn't exist, add it before "Parsed on"
    const parsedOnIndex = jobBlock.indexOf('- Parsed on:');
    if (parsedOnIndex !== -1) {
      updatedBlock = jobBlock.slice(0, parsedOnIndex) + `- ${field}: ${value}\n  ` + jobBlock.slice(parsedOnIndex);
    } else {
      // Just append
      updatedBlock = jobBlock.trimEnd() + `\n  - ${field}: ${value}`;
    }
  }
  
  return content.slice(0, blockStart) + updatedBlock + content.slice(blockEnd);
}

/**
 * Delete a job from markdown by its link
 */
export function deleteJobFromMarkdown(content: string, jobLink: string): string {
  const linkPattern = `- Link: ${jobLink}`;
  const linkIndex = content.indexOf(linkPattern);
  
  if (linkIndex === -1) {
    throw new Error('Job not found');
  }
  
  // Find the start of this job block
  let blockStart = content.lastIndexOf('- **', linkIndex);
  if (blockStart === -1) {
    throw new Error('Job block start not found');
  }
  
  // Handle leading newlines
  while (blockStart > 0 && content[blockStart - 1] === '\n') {
    blockStart--;
  }
  // Keep one newline
  if (content[blockStart] === '\n') {
    blockStart++;
  }
  
  // Find the end of this job block
  let blockEnd = content.indexOf('\n- **', linkIndex);
  if (blockEnd === -1) {
    const nextSection = content.indexOf('\n## ', linkIndex);
    blockEnd = nextSection === -1 ? content.length : nextSection;
  }
  
  return content.slice(0, blockStart) + content.slice(blockEnd);
}

/**
 * Add a column definition to frontmatter
 */
export function addColumnToFrontmatter(fileContent: string, column: Column): string {
  const { data, content } = matter(fileContent);
  
  const columns: Column[] = data.columns || [];
  
  // Check if column already exists
  if (columns.some(c => c.name.toLowerCase() === column.name.toLowerCase())) {
    throw new Error('Column already exists');
  }
  
  columns.push(column);
  
  const newData = { ...data, columns };
  
  return matter.stringify(content, newData);
}

/**
 * Reconstruct full file content from frontmatter and body
 */
export function reconstructFile(data: BoardData, content: string): string {
  const frontmatter: Record<string, unknown> = {
    title: data.title,
    columns: data.columns,
  };
  if (data.pin) {
    frontmatter.pin = data.pin;
  }
  return matter.stringify(content, frontmatter);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

