import type { Board, Job } from '@/lib/kv';
import { generateJobId } from '@/lib/kv';
import type { Interaction, NetworkData, Person, PersonStatus } from '@/lib/network';
import { PERSON_STATUSES, generateInteractionId, generatePersonId } from '@/lib/network';
import type { Column } from '@/lib/markdown';
import { STATUS_OPTIONS, linkScheme } from '@/lib/job-utils';
import {
  CUSTOM_TEXT_MAX,
  LINK_MAX,
  MAX_LINKED_JOBS,
  NOTES_MAX,
  TEXT_FIELD_MAX,
} from '@/lib/limits';
import { fail, ok } from '@/lib/outcome';
import type { Outcome } from '@/lib/outcome';

/**
 * The one place that decides what a job or person update may contain. The web app, the
 * Chrome extension and the MCP tools all send `{ field, value }` pairs through here, so they
 * share the same enum checks, length caps, date formats and custom-column rules.
 */

export interface FieldUpdate {
  field: string;
  value: string;
}

// ── Shared value checks ────────────────────────────────────────────────────

/** Strict calendar date, YYYY-MM-DD (rejects 2024-02-30). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Due-date values: YYYY-MM-DD, "rolling" (no fixed deadline) or empty. */
export function isDueDateValue(value: string): boolean {
  return value === '' || value === 'rolling' || isIsoDate(value);
}

/** Links may be bare ("example.com/jobs") or http(s); other schemes (javascript:, data:) are refused. */
export function getLinkError(link: string): string | null {
  if (link.length > LINK_MAX) return `Link must be ${LINK_MAX} characters or fewer`;
  const scheme = linkScheme(link);
  if (scheme && scheme !== 'http' && scheme !== 'https') return 'Link must be an http(s) URL';
  return null;
}

function tooLong(label: string, max: number): string {
  return `${label} must be ${max} characters or fewer`;
}

/** Case-insensitive match of `value` against `options`, returning the canonical spelling. */
function matchOption(value: string, options: readonly string[]): string | undefined {
  const lower = value.trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === lower);
}

/** The custom column called `name` (case-insensitive), if the document has one. */
export function findColumn(columns: Column[], name: string): Column | undefined {
  const lower = name.trim().toLowerCase();
  return columns.find((column) => column.name.toLowerCase() === lower);
}

type Checked = { value: string } | { error: string };

/** Validate a custom-column value, returning the value to store (canonicalised) or an error. */
function checkCustomValue(column: Column, value: string): Checked {
  switch (column.type) {
    case 'checkbox': {
      const matched = matchOption(value, ['Yes', 'No']);
      return matched ? { value: matched } : { error: `${column.name} must be Yes or No` };
    }
    case 'dropdown': {
      if (value === '') return { value }; // clearing is always allowed
      const options = column.options ?? [];
      const matched = matchOption(value, options);
      return matched
        ? { value: matched }
        : { error: `${column.name} must be one of: ${options.join(', ')}` };
    }
    case 'date':
      // Same rule as the built-in due date: the date picker offers "rolling" for these cells too.
      return isDueDateValue(value)
        ? { value }
        : { error: `${column.name} must be a date (YYYY-MM-DD), "rolling", or empty` };
    default:
      return value.length > CUSTOM_TEXT_MAX
        ? { error: tooLong(column.name, CUSTOM_TEXT_MAX) }
        : { value };
  }
}

function normalizeUpdates(updates: unknown): FieldUpdate[] | string {
  if (!Array.isArray(updates) || updates.length === 0) return 'No fields to update';
  for (const update of updates) {
    if (
      !update ||
      typeof update !== 'object' ||
      typeof (update as FieldUpdate).field !== 'string' ||
      typeof (update as FieldUpdate).value !== 'string'
    ) {
      return 'Each update needs a field name and a string value';
    }
  }
  return updates as FieldUpdate[];
}

/** Turn an object of optional string fields (extension / MCP payloads) into update pairs. */
export function updatesFromObject(
  fields: Record<string, unknown> | undefined,
  customFields?: Record<string, unknown>
): FieldUpdate[] {
  const updates: FieldUpdate[] = [];
  for (const [field, value] of Object.entries(fields ?? {})) {
    if (value !== undefined) updates.push({ field, value: value as string });
  }
  for (const [field, value] of Object.entries(customFields ?? {})) {
    updates.push({ field, value: value as string });
  }
  return updates;
}

// ── Jobs ───────────────────────────────────────────────────────────────────

type JobTextField =
  'title' | 'company' | 'link' | 'location' | 'employmentType' | 'notes' | 'status' | 'dueDate';

// Built-in job fields by the names the UI, the extension and MCP send (matched case-insensitively).
const JOB_FIELDS: Record<string, JobTextField> = {
  title: 'title',
  company: 'company',
  link: 'link',
  location: 'location',
  'employment type': 'employmentType',
  employmenttype: 'employmentType',
  notes: 'notes',
  status: 'status',
  'due date': 'dueDate',
  duedate: 'dueDate',
};

type JobWrite = { builtin: JobTextField; value: string } | { custom: string; value: string };

function checkJobField(board: Board, field: string, value: string): JobWrite | { error: string } {
  const builtin = JOB_FIELDS[field.trim().toLowerCase()];
  if (builtin) {
    switch (builtin) {
      case 'title':
      case 'company': {
        const label = builtin === 'title' ? 'Title' : 'Company';
        if (!value.trim()) return { error: `${label} is required` };
        if (value.length > TEXT_FIELD_MAX) return { error: tooLong(label, TEXT_FIELD_MAX) };
        return { builtin, value };
      }
      case 'link': {
        const error = getLinkError(value);
        return error ? { error } : { builtin, value };
      }
      case 'location':
        return value.length > TEXT_FIELD_MAX
          ? { error: tooLong('Location', TEXT_FIELD_MAX) }
          : { builtin, value };
      case 'employmentType':
        return value.length > TEXT_FIELD_MAX
          ? { error: tooLong('Employment type', TEXT_FIELD_MAX) }
          : { builtin, value };
      case 'notes':
        return value.length > NOTES_MAX
          ? { error: tooLong('Notes', NOTES_MAX) }
          : { builtin, value };
      case 'status': {
        const matched = matchOption(value, STATUS_OPTIONS);
        return matched
          ? { builtin, value: matched }
          : { error: `Status must be one of: ${STATUS_OPTIONS.join(', ')}` };
      }
      case 'dueDate':
        return isDueDateValue(value)
          ? { builtin, value }
          : { error: 'Due date must be YYYY-MM-DD, "rolling", or empty' };
    }
  }

  const column = findColumn(board.columns, field);
  if (!column) return { error: `Unknown column "${field}"` };
  const checked = checkCustomValue(column, value);
  return 'error' in checked ? checked : { custom: column.name, value: checked.value };
}

/**
 * Validate `updates` against the board and apply them to the job — all or nothing.
 * Returns the updated job, or 400/404 with a message the client can show as-is.
 */
export function applyJobUpdates(board: Board, jobId: string, updates: unknown): Outcome<Job> {
  const list = normalizeUpdates(updates);
  if (typeof list === 'string') return fail(400, list);

  const job = board.jobs.find((j) => j.id === jobId);
  if (!job) return fail(404, 'Job not found');

  const writes: JobWrite[] = [];
  for (const { field, value } of list) {
    const checked = checkJobField(board, field, value);
    if ('error' in checked) return fail(400, checked.error);
    writes.push(checked);
  }

  for (const write of writes) {
    if ('builtin' in write) job[write.builtin] = write.value;
    else job.customFields[write.custom] = write.value;
  }
  return ok(job);
}

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * Add a job from user-entered fields (manual form, extension manual path, MCP add_job).
 * Seeds custom-column defaults, then runs the provided fields through the same validation
 * as updates. `verified` is the source marker ("Manual" for the web form, "No" otherwise).
 */
export function addManualJob(board: Board, input: unknown, verified: string): Outcome<Job> {
  if (!input || typeof input !== 'object') return fail(400, 'Invalid job data');
  const fields = input as Record<string, unknown>;

  const title = str(fields.title)?.trim() ?? '';
  const company = str(fields.company)?.trim() ?? '';
  if (!title || !company) return fail(400, 'Title and company are required');

  const customFields: Record<string, string> = {};
  for (const column of board.columns) {
    customFields[column.name] = column.type === 'checkbox' ? 'No' : '';
  }

  const job: Job = {
    id: generateJobId(),
    title,
    company,
    link: str(fields.link)?.trim() ?? '',
    location: str(fields.location)?.trim() || 'Not listed',
    employmentType: str(fields.employmentType)?.trim() || 'Not listed',
    notes: str(fields.notes) ?? '',
    status: 'Saved',
    dueDate: '',
    parsedOn: new Date().toISOString().split('T')[0],
    verified,
    customFields,
  };
  board.jobs.push(job);

  const updates: FieldUpdate[] = [
    { field: 'title', value: job.title },
    { field: 'company', value: job.company },
    { field: 'link', value: job.link },
    { field: 'location', value: job.location },
    { field: 'employment type', value: job.employmentType },
    { field: 'notes', value: job.notes },
  ];
  const custom = fields.customFields;
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    for (const [field, value] of Object.entries(custom)) {
      if (typeof value === 'string') updates.push({ field, value });
    }
  }

  const applied = applyJobUpdates(board, job.id, updates);
  if (!applied.ok) {
    board.jobs.pop();
    return applied;
  }
  return ok(job);
}

// ── People ─────────────────────────────────────────────────────────────────

type PersonTextField = 'name' | 'linkedinUrl' | 'company' | 'role';
type PersonField = PersonTextField | 'status' | 'lastContacted' | 'linkedJobIds';

// Built-in person fields by the names the UI and MCP send (matched case-insensitively).
const PERSON_FIELDS: Record<string, PersonField> = {
  name: 'name',
  linkedinurl: 'linkedinUrl',
  'linkedin url': 'linkedinUrl',
  company: 'company',
  role: 'role',
  status: 'status',
  lastcontacted: 'lastContacted',
  'last contacted': 'lastContacted',
  linkedjobids: 'linkedJobIds',
};

type PersonWrite =
  | { text: PersonTextField; value: string }
  | { status: PersonStatus }
  | { lastContacted: string | null }
  | { linkedJobIds: string[] }
  | { custom: string; value: string };

function checkPersonField(
  network: NetworkData,
  field: string,
  value: string
): PersonWrite | { error: string } {
  const builtin = PERSON_FIELDS[field.trim().toLowerCase()];
  if (builtin) {
    switch (builtin) {
      case 'name':
      case 'company':
      case 'role': {
        const label = builtin === 'name' ? 'Name' : builtin === 'company' ? 'Company' : 'Role';
        return value.length > TEXT_FIELD_MAX
          ? { error: tooLong(label, TEXT_FIELD_MAX) }
          : { text: builtin, value };
      }
      case 'linkedinUrl': {
        const error = getLinkError(value);
        return error ? { error } : { text: builtin, value };
      }
      case 'status': {
        const matched = matchOption(value, PERSON_STATUSES);
        return matched
          ? { status: matched as PersonStatus }
          : { error: `Status must be one of: ${PERSON_STATUSES.join(', ')}` };
      }
      case 'lastContacted':
        if (value === '') return { lastContacted: null };
        return isIsoDate(value)
          ? { lastContacted: value }
          : { error: 'Last contacted must be a date (YYYY-MM-DD) or empty' };
      case 'linkedJobIds': {
        let ids: unknown;
        try {
          ids = JSON.parse(value);
        } catch {
          return { error: 'linkedJobIds must be a JSON array of job ids' };
        }
        if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id.length > 100)) {
          return { error: 'linkedJobIds must be a JSON array of job ids' };
        }
        if (ids.length > MAX_LINKED_JOBS) {
          return { error: `A person can be linked to at most ${MAX_LINKED_JOBS} jobs` };
        }
        return { linkedJobIds: ids as string[] };
      }
    }
  }

  const column = findColumn(network.columns, field);
  if (!column) return { error: `Unknown column "${field}"` };
  const checked = checkCustomValue(column, value);
  return 'error' in checked ? checked : { custom: column.name, value: checked.value };
}

/**
 * Validate `updates` against the network and apply them to the person — all or nothing.
 */
export function applyPersonUpdates(
  network: NetworkData,
  personId: string,
  updates: unknown
): Outcome<Person> {
  const list = normalizeUpdates(updates);
  if (typeof list === 'string') return fail(400, list);

  const person = network.people.find((p) => p.id === personId);
  if (!person) return fail(404, 'Person not found');

  const writes: PersonWrite[] = [];
  for (const { field, value } of list) {
    const checked = checkPersonField(network, field, value);
    if ('error' in checked) return fail(400, checked.error);
    writes.push(checked);
  }

  for (const write of writes) {
    if ('text' in write) person[write.text] = write.value;
    else if ('status' in write) person.status = write.status;
    else if ('lastContacted' in write) person.lastContacted = write.lastContacted;
    else if ('linkedJobIds' in write) person.linkedJobIds = write.linkedJobIds;
    else person.customFields[write.custom] = write.value;
  }
  return ok(person);
}

/**
 * Add a person from user-entered fields (add form, MCP add_person). Seeds custom-column
 * defaults, then validates the provided fields like an update. New people go to the top.
 */
export function addPerson(network: NetworkData, input: unknown): Outcome<Person> {
  if (!input || typeof input !== 'object') return fail(400, 'Invalid person data');
  const fields = input as Record<string, unknown>;

  const customFields: Record<string, string> = {};
  for (const column of network.columns) {
    customFields[column.name] = column.type === 'checkbox' ? 'No' : '';
  }

  const person: Person = {
    id: generatePersonId(),
    name: str(fields.name)?.trim() ?? '',
    linkedinUrl: str(fields.linkedinUrl)?.trim() ?? '',
    company: str(fields.company)?.trim() ?? '',
    role: str(fields.role)?.trim() ?? '',
    status: 'not-contacted',
    lastContacted: null,
    linkedJobIds: [],
    interactions: [],
    customFields,
    createdAt: new Date().toISOString(),
  };
  network.people.unshift(person);

  const updates: FieldUpdate[] = [
    { field: 'name', value: person.name },
    { field: 'linkedinUrl', value: person.linkedinUrl },
    { field: 'company', value: person.company },
    { field: 'role', value: person.role },
  ];
  const status = str(fields.status);
  if (status) updates.push({ field: 'status', value: status });
  const custom = fields.customFields;
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    for (const [field, value] of Object.entries(custom)) {
      if (typeof value === 'string') updates.push({ field, value });
    }
  }

  const applied = applyPersonUpdates(network, person.id, updates);
  if (!applied.ok) {
    network.people.shift();
    return applied;
  }
  return ok(person);
}

// ── Interactions ───────────────────────────────────────────────────────────

export const INTERACTION_TYPES: readonly Interaction['type'][] = [
  'reached-out',
  'met',
  'followed-up',
  'note',
];

/** Log an interaction, bumping last-contacted and (for non-notes) the person's status. */
export function logInteraction(
  network: NetworkData,
  personId: unknown,
  input: { type: unknown; note?: unknown; followUpDate?: unknown }
): Outcome<{ person: Person; interaction: Interaction }> {
  if (typeof personId !== 'string' || !personId) return fail(400, 'personId is required');
  const type = str(input.type);
  if (!type || !INTERACTION_TYPES.includes(type as Interaction['type'])) {
    return fail(400, `Interaction type must be one of: ${INTERACTION_TYPES.join(', ')}`);
  }
  const note = str(input.note);
  if (note && note.length > NOTES_MAX) return fail(400, tooLong('Note', NOTES_MAX));
  const followUpDate = str(input.followUpDate);
  if (followUpDate && followUpDate.length > TEXT_FIELD_MAX) {
    return fail(400, tooLong('Follow-up date', TEXT_FIELD_MAX));
  }

  const person = network.people.find((p) => p.id === personId);
  if (!person) return fail(404, 'Person not found');

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
  if (followUpDate) person.customFields['Follow-up date'] = followUpDate;

  return ok({ person, interaction });
}
