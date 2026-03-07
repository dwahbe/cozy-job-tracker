import { z } from 'zod';
import { getBoardByUserId, saveBoardByUserId, generateJobId, pruneTrash } from '@/lib/kv';
import type { Job, TrashedJob } from '@/lib/kv';
import {
  getNetworkByUserId,
  saveNetworkByUserId,
  generatePersonId,
  generateInteractionId,
  PERSON_STATUSES,
  STATUS_LABELS,
} from '@/lib/network';
import type { Person, PersonStatus, Interaction, NetworkData } from '@/lib/network';
import { fetchPage } from '@/lib/fetchPage';
import { extractJob } from '@/lib/extractJob';
import { validateExtraction } from '@/lib/validateExtraction';
import { revalidatePath } from 'next/cache';

type TextResult = { content: { type: 'text'; text: string }[]; isError?: boolean };
type Extra = { authInfo?: { extra?: Record<string, unknown> } };

function txt(msg: string, isError?: boolean): TextResult {
  return { content: [{ type: 'text', text: msg }], ...(isError ? { isError: true } : {}) };
}

const BOARD_NOT_FOUND = txt('Board not found. Create one at cozyjobtracker.com.', true);

function getUserId(extra: Extra): string {
  return extra.authInfo?.extra?.userId as string;
}

function formatJob(job: Job): string {
  const lines = [`**${job.title}** at ${job.company}`, `Status: ${job.status}`, `ID: ${job.id}`];
  if (job.location && job.location !== 'Not listed') lines.push(`Location: ${job.location}`);
  if (job.employmentType && job.employmentType !== 'Not listed')
    lines.push(`Type: ${job.employmentType}`);
  if (job.link) lines.push(`Link: ${job.link}`);
  if (job.dueDate) lines.push(`Due: ${job.dueDate}`);
  if (job.notes) lines.push(`Notes: ${job.notes}`);

  const customEntries = Object.entries(job.customFields).filter(([, v]) => v);
  if (customEntries.length > 0) {
    for (const [key, value] of customEntries) {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

const NETWORK_NOT_FOUND = txt(
  'Network not found. Enable networking at cozyjobtracker.com/network.',
  true
);

async function getNetwork(userId: string): Promise<NetworkData | null> {
  const data = await getNetworkByUserId(userId);
  if (!data) return null;
  return data;
}

function formatPerson(person: Person): string {
  const statusLabel = STATUS_LABELS[person.status] ?? person.status;
  const lines = [
    `**${person.name}**${person.company ? ` at ${person.company}` : ''}`,
    `Status: ${statusLabel}`,
    `ID: ${person.id}`,
  ];
  if (person.role) lines.push(`Role: ${person.role}`);
  if (person.linkedinUrl) lines.push(`LinkedIn: ${person.linkedinUrl}`);
  if (person.lastContacted) lines.push(`Last contacted: ${person.lastContacted}`);
  if (person.interactions.length > 0)
    lines.push(`Interactions: ${person.interactions.length}`);

  const customEntries = Object.entries(person.customFields).filter(([, v]) => v);
  if (customEntries.length > 0) {
    for (const [key, value] of customEntries) {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

interface ToolDef {
  name: string;
  config: Record<string, unknown>;
  handler: (...args: unknown[]) => Promise<TextResult>;
}

export const toolDefinitions: ToolDef[] = [
  // ── list_jobs ──────────────────────────────────────────────
  {
    name: 'list_jobs',
    config: {
      title: 'List jobs',
      description:
        'List all jobs on the board. Optionally filter by status (Saved, Applied, Interview, Offer, Rejected).',
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe('Filter by job status: Saved, Applied, Interview, Offer, or Rejected'),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { status } = args as { status?: string };
      const board = await getBoardByUserId(getUserId(extra as Extra));
      if (!board) return BOARD_NOT_FOUND;

      let jobs = board.jobs;
      if (status) jobs = jobs.filter((j) => j.status === status);

      if (jobs.length === 0) {
        return txt(status ? `No jobs with status "${status}".` : 'No jobs on the board yet.');
      }

      const out = jobs.map(formatJob).join('\n\n---\n\n');
      return txt(`${jobs.length} job(s):\n\n${out}`);
    },
  },

  // ── get_job ────────────────────────────────────────────────
  {
    name: 'get_job',
    config: {
      title: 'Get job details',
      description: 'Get full details of a specific job by its ID.',
      inputSchema: {
        jobId: z.string().describe('The job ID'),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { jobId } = args as { jobId: string };
      const board = await getBoardByUserId(getUserId(extra as Extra));
      if (!board) return BOARD_NOT_FOUND;

      const job = board.jobs.find((j) => j.id === jobId);
      if (!job) return txt(`Job "${jobId}" not found.`, true);
      return txt(formatJob(job));
    },
  },

  // ── add_job ────────────────────────────────────────────────
  {
    name: 'add_job',
    config: {
      title: 'Add a job',
      description:
        'Add a new job to the board. A link is optional — you can add a job with just a title and company.',
      inputSchema: {
        title: z.string().describe('Job title / position name'),
        company: z.string().describe('Company name'),
        link: z.string().optional().describe('URL of the job posting (optional)'),
        location: z.string().optional().describe('Job location'),
        employmentType: z.string().optional().describe('e.g. Full-time, Part-time, Contract'),
        notes: z.string().optional().describe('Any notes about this job'),
      },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { title, company, link, location, employmentType, notes } = args as {
        title: string;
        company: string;
        link?: string;
        location?: string;
        employmentType?: string;
        notes?: string;
      };
      const userId = getUserId(extra as Extra);
      const board = await getBoardByUserId(userId);
      if (!board) return BOARD_NOT_FOUND;

      const customFields: Record<string, string> = {};
      for (const col of board.columns) {
        customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
      }

      const newJob: Job = {
        id: generateJobId(),
        title,
        company,
        link: link || '',
        location: location || 'Not listed',
        employmentType: employmentType || 'Not listed',
        notes: notes || '',
        status: 'Saved',
        dueDate: '',
        parsedOn: new Date().toISOString().split('T')[0],
        verified: 'No',
        customFields,
      };

      board.jobs.push(newJob);
      await saveBoardByUserId(userId, board);
      revalidatePath('/board');

      return txt(`Added "${title}" at ${company} to the board.`);
    },
  },

  // ── update_job ─────────────────────────────────────────────
  {
    name: 'update_job',
    config: {
      title: 'Update a job',
      description:
        'Update fields on an existing job. Provide the job ID and whichever fields you want to change. Use customFields to set custom column values by column name.',
      inputSchema: {
        jobId: z.string().describe('The job ID to update'),
        title: z.string().optional().describe('New job title'),
        company: z.string().optional().describe('New company name'),
        link: z.string().optional().describe('New job posting URL'),
        location: z.string().optional().describe('New location'),
        employmentType: z.string().optional().describe('New employment type'),
        notes: z.string().optional().describe('New notes (replaces existing)'),
        status: z
          .string()
          .optional()
          .describe('New status: Saved, Applied, Interview, Offer, or Rejected'),
        dueDate: z.string().optional().describe('New due date (YYYY-MM-DD)'),
        customFields: z
          .record(z.string())
          .optional()
          .describe(
            'Custom column values to update, keyed by column name. For checkbox columns use "Yes"/"No". For dropdown columns use one of the allowed options.'
          ),
      },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { jobId, customFields, ...fields } = args as {
        jobId: string;
        customFields?: Record<string, string>;
        title?: string;
        company?: string;
        link?: string;
        location?: string;
        employmentType?: string;
        notes?: string;
        status?: string;
        dueDate?: string;
      };
      const userId = getUserId(extra as Extra);
      const board = await getBoardByUserId(userId);
      if (!board) return BOARD_NOT_FOUND;

      const job = board.jobs.find((j) => j.id === jobId);
      if (!job) return txt(`Job "${jobId}" not found.`, true);

      const standardUpdates = Object.entries(fields).filter(([, v]) => v !== undefined);
      const hasCustom = customFields && Object.keys(customFields).length > 0;

      if (standardUpdates.length === 0 && !hasCustom) {
        return txt('No fields to update.', true);
      }

      for (const [key, value] of standardUpdates) {
        (job as unknown as Record<string, unknown>)[key] = value;
      }

      if (hasCustom) {
        const colMap = new Map(board.columns.map((c) => [c.name, c]));
        for (const [name, value] of Object.entries(customFields)) {
          const col = colMap.get(name);
          if (!col) return txt(`Custom column "${name}" does not exist on this board.`, true);

          if (col.type === 'checkbox' && value !== 'Yes' && value !== 'No') {
            return txt(`Column "${name}" is a checkbox — use "Yes" or "No".`, true);
          }
          if (col.type === 'dropdown' && col.options && !col.options.includes(value)) {
            return txt(
              `Column "${name}" only accepts: ${col.options.join(', ')}. Got "${value}".`,
              true
            );
          }

          job.customFields[name] = value;
        }
      }

      await saveBoardByUserId(userId, board);
      revalidatePath('/board');

      return txt(`Updated job "${job.title}" at ${job.company}.`);
    },
  },

  // ── delete_job ─────────────────────────────────────────────
  {
    name: 'delete_job',
    config: {
      title: 'Delete a job',
      description: 'Move a job to the trash. It can be restored within 30 days.',
      inputSchema: {
        jobId: z.string().describe('The job ID to delete'),
      },
      annotations: { destructiveHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { jobId } = args as { jobId: string };
      const userId = getUserId(extra as Extra);
      const board = await getBoardByUserId(userId);
      if (!board) return BOARD_NOT_FOUND;

      const idx = board.jobs.findIndex((j) => j.id === jobId);
      if (idx === -1) return txt(`Job "${jobId}" not found.`, true);

      const [job] = board.jobs.splice(idx, 1);
      const trashedJob: TrashedJob = { ...job, deletedAt: new Date().toISOString() };
      if (!board.trash) board.trash = [];
      board.trash.unshift(trashedJob);

      await saveBoardByUserId(userId, board);
      revalidatePath('/board');
      revalidatePath('/trash');

      return txt('Job moved to trash.');
    },
  },

  // ── search_jobs ────────────────────────────────────────────
  {
    name: 'search_jobs',
    config: {
      title: 'Search jobs',
      description: 'Search jobs by text across title, company, location, and notes.',
      inputSchema: {
        query: z.string().describe('Search text'),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { query } = args as { query: string };
      const board = await getBoardByUserId(getUserId(extra as Extra));
      if (!board) return BOARD_NOT_FOUND;

      const q = query.toLowerCase();
      const matches = board.jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.notes.toLowerCase().includes(q)
      );

      if (matches.length === 0) return txt(`No jobs matching "${query}".`);

      const out = matches.map(formatJob).join('\n\n---\n\n');
      return txt(`${matches.length} result(s):\n\n${out}`);
    },
  },

  // ── get_board_summary ──────────────────────────────────────
  {
    name: 'get_board_summary',
    config: {
      title: 'Board summary',
      description:
        'Get a summary of the job board: total jobs, counts by status, and recent additions.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    handler: async (_args: unknown, extra: unknown): Promise<TextResult> => {
      const board = await getBoardByUserId(getUserId(extra as Extra));
      if (!board) return BOARD_NOT_FOUND;

      pruneTrash(board);
      const total = board.jobs.length;
      const byStatus: Record<string, number> = {};
      for (const job of board.jobs) {
        byStatus[job.status] = (byStatus[job.status] || 0) + 1;
      }

      const sorted = [...board.jobs].sort(
        (a, b) => parseInt(b.id.split('-')[0]) - parseInt(a.id.split('-')[0])
      );
      const recent = sorted.slice(0, 5);
      const trashCount = board.trash?.length ?? 0;

      const lines = [`**${board.title}**`, `Total jobs: ${total}`];

      if (total > 0) {
        lines.push('');
        lines.push('By status:');
        for (const [status, count] of Object.entries(byStatus)) {
          lines.push(`  ${status}: ${count}`);
        }
      }

      if (trashCount > 0) {
        lines.push(`\nTrash: ${trashCount} job(s)`);
      }

      if (recent.length > 0) {
        lines.push('');
        lines.push('Recently added:');
        for (const job of recent) {
          lines.push(`  - ${job.title} at ${job.company} (${job.status})`);
        }
      }

      return txt(lines.join('\n'));
    },
  },

  // ── parse_job_url ──────────────────────────────────────────
  {
    name: 'parse_job_url',
    config: {
      title: 'Parse a job URL',
      description:
        'Parse a job posting URL and return the extracted fields without saving to the board. Useful for previewing what a listing contains.',
      inputSchema: {
        url: z.string().url().describe('URL of the job posting to parse'),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args: unknown): Promise<TextResult> => {
      const { url } = args as { url: string };
      try {
        const pageResult = await fetchPage(url);

        if (pageResult.fetchError && pageResult.text.length === 0) {
          return txt(`Failed to fetch: ${pageResult.fetchError}`, true);
        }

        const extraction = await extractJob(pageResult.text, pageResult.title, pageResult.finalUrl);
        const job = validateExtraction(
          extraction,
          pageResult.text,
          pageResult.fetchedAt,
          pageResult.finalUrl
        );

        const lines = [
          `**${job.title}** at ${job.company}`,
          `Location: ${job.location || 'Not listed'}`,
          `Type: ${job.employment_type || 'Not listed'}`,
          `Link: ${job.finalUrl}`,
        ];
        if (job.due_date) lines.push(`Due: ${job.due_date}`);
        if (job.notes) lines.push(`Notes: ${job.notes}`);
        if (pageResult.fetchError) lines.push(`\nWarning: ${pageResult.fetchError}`);

        return txt(lines.join('\n'));
      } catch (error) {
        return txt(
          `Failed to parse URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Network (contacts) tools
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── list_people ─────────────────────────────────────────────
  {
    name: 'list_people',
    config: {
      title: 'List people',
      description:
        'List all people in the network. Optionally filter by status (not-contacted, reached-out, waiting, in-conversation, paused).',
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe(
            'Filter by status: not-contacted, reached-out, waiting, in-conversation, or paused'
          ),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { status } = args as { status?: string };
      const network = await getNetwork(getUserId(extra as Extra));
      if (!network) return NETWORK_NOT_FOUND;

      let people = network.people;
      if (status) people = people.filter((p) => p.status === status);

      if (people.length === 0) {
        return txt(
          status ? `No people with status "${status}".` : 'No people in the network yet.'
        );
      }

      const out = people.map(formatPerson).join('\n\n---\n\n');
      return txt(`${people.length} person(s):\n\n${out}`);
    },
  },

  // ── get_person ──────────────────────────────────────────────
  {
    name: 'get_person',
    config: {
      title: 'Get person details',
      description:
        'Get full details of a person by ID, including their interaction history.',
      inputSchema: {
        personId: z.string().describe('The person ID'),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { personId } = args as { personId: string };
      const network = await getNetwork(getUserId(extra as Extra));
      if (!network) return NETWORK_NOT_FOUND;

      const person = network.people.find((p) => p.id === personId);
      if (!person) return txt(`Person "${personId}" not found.`, true);

      const lines = [formatPerson(person)];

      if (person.interactions.length > 0) {
        lines.push('', 'Interaction history:');
        for (const ix of person.interactions) {
          const entry = `  - ${ix.date} [${ix.type}]${ix.note ? `: ${ix.note}` : ''}`;
          lines.push(entry);
        }
      }

      return txt(lines.join('\n'));
    },
  },

  // ── search_people ───────────────────────────────────────────
  {
    name: 'search_people',
    config: {
      title: 'Search people',
      description: 'Search people by text across name, company, and role.',
      inputSchema: {
        query: z.string().describe('Search text'),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { query } = args as { query: string };
      const network = await getNetwork(getUserId(extra as Extra));
      if (!network) return NETWORK_NOT_FOUND;

      const q = query.toLowerCase();
      const matches = network.people.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q)
      );

      if (matches.length === 0) return txt(`No people matching "${query}".`);

      const out = matches.map(formatPerson).join('\n\n---\n\n');
      return txt(`${matches.length} result(s):\n\n${out}`);
    },
  },

  // ── get_network_summary ─────────────────────────────────────
  {
    name: 'get_network_summary',
    config: {
      title: 'Network summary',
      description:
        'Get a summary of the networking board: total people, counts by status, and recent additions.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    handler: async (_args: unknown, extra: unknown): Promise<TextResult> => {
      const network = await getNetwork(getUserId(extra as Extra));
      if (!network) return NETWORK_NOT_FOUND;

      const total = network.people.length;
      const byStatus: Record<string, number> = {};
      for (const person of network.people) {
        const label = STATUS_LABELS[person.status] ?? person.status;
        byStatus[label] = (byStatus[label] || 0) + 1;
      }

      const recent = [...network.people]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);

      const lines = ['**Network**', `Total people: ${total}`];

      if (total > 0) {
        lines.push('', 'By status:');
        for (const [status, count] of Object.entries(byStatus)) {
          lines.push(`  ${status}: ${count}`);
        }
      }

      if (recent.length > 0) {
        lines.push('', 'Recently added:');
        for (const p of recent) {
          const label = STATUS_LABELS[p.status] ?? p.status;
          lines.push(`  - ${p.name}${p.company ? ` at ${p.company}` : ''} (${label})`);
        }
      }

      return txt(lines.join('\n'));
    },
  },

  // ── add_person ──────────────────────────────────────────────
  {
    name: 'add_person',
    config: {
      title: 'Add a person',
      description:
        'Add a person to the networking board. Only name is required.',
      inputSchema: {
        name: z.string().describe('Person name'),
        company: z.string().optional().describe('Company name'),
        role: z.string().optional().describe('Job title / role'),
        linkedinUrl: z.string().optional().describe('LinkedIn profile URL'),
        status: z
          .string()
          .optional()
          .describe(
            'Status: not-contacted, reached-out, waiting, in-conversation, or paused. Defaults to not-contacted.'
          ),
      },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { name, company, role, linkedinUrl, status } = args as {
        name: string;
        company?: string;
        role?: string;
        linkedinUrl?: string;
        status?: string;
      };
      const userId = getUserId(extra as Extra);
      const network = await getNetwork(userId);
      if (!network) return NETWORK_NOT_FOUND;

      const personStatus: PersonStatus =
        status && PERSON_STATUSES.includes(status as PersonStatus)
          ? (status as PersonStatus)
          : 'not-contacted';

      const customFields: Record<string, string> = {};
      for (const col of network.columns) {
        customFields[col.name] = col.type === 'checkbox' ? 'No' : '';
      }

      const person: Person = {
        id: generatePersonId(),
        name,
        linkedinUrl: linkedinUrl || '',
        company: company || '',
        role: role || '',
        status: personStatus,
        lastContacted: null,
        linkedJobIds: [],
        interactions: [],
        customFields,
        createdAt: new Date().toISOString(),
      };

      network.people.unshift(person);
      await saveNetworkByUserId(userId, network);
      revalidatePath('/network');

      return txt(`Added ${name}${company ? ` at ${company}` : ''} to the network.`);
    },
  },

  // ── update_person ───────────────────────────────────────────
  {
    name: 'update_person',
    config: {
      title: 'Update a person',
      description:
        'Update fields on an existing person. Provide the person ID and whichever fields you want to change. Use customFields to set custom column values by column name.',
      inputSchema: {
        personId: z.string().describe('The person ID to update'),
        name: z.string().optional().describe('New name'),
        company: z.string().optional().describe('New company'),
        role: z.string().optional().describe('New role / title'),
        linkedinUrl: z.string().optional().describe('New LinkedIn URL'),
        status: z
          .string()
          .optional()
          .describe(
            'New status: not-contacted, reached-out, waiting, in-conversation, or paused'
          ),
        customFields: z
          .record(z.string())
          .optional()
          .describe(
            'Custom column values to update, keyed by column name. For checkbox columns use "Yes"/"No". For dropdown columns use one of the allowed options.'
          ),
      },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { personId, customFields, ...fields } = args as {
        personId: string;
        customFields?: Record<string, string>;
        name?: string;
        company?: string;
        role?: string;
        linkedinUrl?: string;
        status?: string;
      };
      const userId = getUserId(extra as Extra);
      const network = await getNetwork(userId);
      if (!network) return NETWORK_NOT_FOUND;

      const person = network.people.find((p) => p.id === personId);
      if (!person) return txt(`Person "${personId}" not found.`, true);

      const standardUpdates = Object.entries(fields).filter(([, v]) => v !== undefined);
      const hasCustom = customFields && Object.keys(customFields).length > 0;

      if (standardUpdates.length === 0 && !hasCustom) {
        return txt('No fields to update.', true);
      }

      if (fields.status && !PERSON_STATUSES.includes(fields.status as PersonStatus)) {
        return txt(
          `Invalid status "${fields.status}". Use: ${PERSON_STATUSES.join(', ')}.`,
          true
        );
      }

      for (const [key, value] of standardUpdates) {
        (person as unknown as Record<string, unknown>)[key] = value;
      }

      if (hasCustom) {
        const colMap = new Map(network.columns.map((c) => [c.name, c]));
        for (const [colName, value] of Object.entries(customFields)) {
          const col = colMap.get(colName);
          if (!col)
            return txt(`Custom column "${colName}" does not exist on the network.`, true);

          if (col.type === 'checkbox' && value !== 'Yes' && value !== 'No') {
            return txt(`Column "${colName}" is a checkbox — use "Yes" or "No".`, true);
          }
          if (col.type === 'dropdown' && col.options && !col.options.includes(value)) {
            return txt(
              `Column "${colName}" only accepts: ${col.options.join(', ')}. Got "${value}".`,
              true
            );
          }

          person.customFields[colName] = value;
        }
      }

      await saveNetworkByUserId(userId, network);
      revalidatePath('/network');

      return txt(`Updated ${person.name}.`);
    },
  },

  // ── delete_person ───────────────────────────────────────────
  {
    name: 'delete_person',
    config: {
      title: 'Delete a person',
      description: 'Permanently delete a person from the networking board.',
      inputSchema: {
        personId: z.string().describe('The person ID to delete'),
      },
      annotations: { destructiveHint: true },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { personId } = args as { personId: string };
      const userId = getUserId(extra as Extra);
      const network = await getNetwork(userId);
      if (!network) return NETWORK_NOT_FOUND;

      const idx = network.people.findIndex((p) => p.id === personId);
      if (idx === -1) return txt(`Person "${personId}" not found.`, true);

      const [person] = network.people.splice(idx, 1);
      await saveNetworkByUserId(userId, network);
      revalidatePath('/network');

      return txt(`Deleted ${person.name} from the network.`);
    },
  },

  // ── log_interaction ─────────────────────────────────────────
  {
    name: 'log_interaction',
    config: {
      title: 'Log an interaction',
      description:
        'Log an interaction with a person. Automatically updates their last-contacted date and status.',
      inputSchema: {
        personId: z.string().describe('The person ID'),
        type: z
          .string()
          .describe('Interaction type: reached-out, met, followed-up, or note'),
        note: z.string().optional().describe('Optional note about the interaction'),
      },
    },
    handler: async (args: unknown, extra: unknown): Promise<TextResult> => {
      const { personId, type, note } = args as {
        personId: string;
        type: string;
        note?: string;
      };
      const userId = getUserId(extra as Extra);
      const network = await getNetwork(userId);
      if (!network) return NETWORK_NOT_FOUND;

      const validTypes = ['reached-out', 'met', 'followed-up', 'note'] as const;
      if (!validTypes.includes(type as Interaction['type'])) {
        return txt(
          `Invalid interaction type "${type}". Use: ${validTypes.join(', ')}.`,
          true
        );
      }

      const person = network.people.find((p) => p.id === personId);
      if (!person) return txt(`Person "${personId}" not found.`, true);

      const interaction: Interaction = {
        id: generateInteractionId(),
        type: type as Interaction['type'],
        date: new Date().toISOString().split('T')[0],
        ...(note ? { note } : {}),
      };

      person.interactions.unshift(interaction);
      person.lastContacted = interaction.date;

      if (type !== 'note') {
        person.status = type === 'reached-out' ? 'reached-out' : 'in-conversation';
      }

      await saveNetworkByUserId(userId, network);
      revalidatePath('/network');

      const label = STATUS_LABELS[person.status] ?? person.status;
      return txt(
        `Logged "${type}" interaction with ${person.name}. Status is now "${label}".`
      );
    },
  },
];
