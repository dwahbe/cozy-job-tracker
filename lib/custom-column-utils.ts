import type { Column } from '@/lib/markdown';
import {
  COLUMN_NAME_MAX,
  DROPDOWN_OPTION_MAX,
  MAX_COLUMNS,
  MAX_DROPDOWN_OPTIONS,
} from '@/lib/limits';
import { fail, ok, type Outcome } from '@/lib/outcome';

export const VALID_COLUMN_TYPES: Column['type'][] = ['text', 'checkbox', 'dropdown', 'date'];

export type ColumnKind = 'board' | 'network';

// Names that collide with built-in fields, matched case-insensitively. The network's prebuilt
// "Notes" and "Location" columns are custom columns, so those stay allowed there.
const RESERVED_COLUMN_NAMES: Record<ColumnKind, ReadonlySet<string>> = {
  board: new Set([
    'id',
    'title',
    'company',
    'link',
    'location',
    'employment type',
    'employmenttype',
    'type',
    'due date',
    'duedate',
    'notes',
    'status',
    'parsed on',
    'parsedon',
    'verified',
  ]),
  network: new Set([
    'id',
    'name',
    'linkedin',
    'linkedin / site',
    'linkedin url',
    'linkedinurl',
    'company',
    'role',
    'title',
    'status',
    'last contacted',
    'lastcontacted',
    'linked jobs',
    'linkedjobids',
    'interactions',
    'created at',
    'createdat',
  ]),
};

export function isReservedColumnName(name: string, kind: ColumnKind): boolean {
  return RESERVED_COLUMN_NAMES[kind].has(name.trim().toLowerCase());
}

/**
 * Validate a column payload (shape, name, type, options). Pass `kind` to also reject names that
 * collide with that document's built-in fields.
 */
export function getColumnValidationError(column: unknown, kind?: ColumnKind): string | null {
  if (!column || typeof column !== 'object' || Array.isArray(column)) {
    return 'Column name and type are required';
  }
  const { name, type, options, optionColors } = column as Partial<Column>;

  if (typeof name !== 'string' || !name.trim() || !type) {
    return 'Column name and type are required';
  }
  if (name.trim().length > COLUMN_NAME_MAX) {
    return `Column name must be ${COLUMN_NAME_MAX} characters or fewer`;
  }
  if (kind && isReservedColumnName(name, kind)) {
    return `"${name.trim()}" is a built-in column name — pick another`;
  }
  if (!VALID_COLUMN_TYPES.includes(type)) {
    return `Column type must be one of: ${VALID_COLUMN_TYPES.join(', ')}`;
  }
  if (type === 'dropdown') {
    if (!Array.isArray(options) || options.length === 0) {
      return 'Dropdown columns require at least one option';
    }
    if (options.length > MAX_DROPDOWN_OPTIONS) {
      return `Dropdown columns can have up to ${MAX_DROPDOWN_OPTIONS} options`;
    }
    if (options.some((o) => typeof o !== 'string' || !o.trim())) {
      return 'Dropdown options must be non-empty text';
    }
    if (options.some((o) => o.length > DROPDOWN_OPTION_MAX)) {
      return `Dropdown options must be ${DROPDOWN_OPTION_MAX} characters or fewer`;
    }
  }
  if (
    optionColors !== undefined &&
    (typeof optionColors !== 'object' ||
      optionColors === null ||
      Array.isArray(optionColors) ||
      Object.values(optionColors).some((v) => typeof v !== 'string'))
  ) {
    return 'Option colours must map option names to colour keys';
  }
  return null;
}

/** A validated column payload with only the fields we store. */
function sanitizeColumn(input: Column): Column {
  const column: Column = { name: input.name.trim(), type: input.type };
  if (input.type === 'dropdown' && input.options) {
    column.options = input.options.map((o) => o.trim());
    if (input.optionColors && Object.keys(input.optionColors).length > 0) {
      column.optionColors = { ...input.optionColors };
    }
  }
  return column;
}

export function getOrderedColumnIds(
  savedOrder: string[] | undefined,
  builtinIds: readonly string[],
  customColumns: Column[]
): string[] {
  const customNames = customColumns.map((column) => column.name);

  if (!savedOrder || savedOrder.length === 0) {
    return [...builtinIds, ...customNames];
  }

  const validIds = new Set([...builtinIds, ...customNames]);
  const seen = new Set<string>();
  const nextOrder: string[] = [];

  for (const id of savedOrder) {
    if (!validIds.has(id) || seen.has(id)) continue;
    nextOrder.push(id);
    seen.add(id);
  }

  for (const id of [...builtinIds, ...customNames]) {
    if (seen.has(id)) continue;
    nextOrder.push(id);
    seen.add(id);
  }

  return nextOrder;
}

export function renameColumnInOrder(
  savedOrder: string[] | undefined,
  oldName: string,
  newName: string
): string[] | undefined {
  if (!savedOrder || savedOrder.length === 0) return savedOrder;

  const seen = new Set<string>();
  const nextOrder: string[] = [];

  for (const id of savedOrder) {
    const nextId = id === oldName ? newName : id;
    if (seen.has(nextId)) continue;
    nextOrder.push(nextId);
    seen.add(nextId);
  }

  return nextOrder;
}

export function removeColumnFromOrder(
  savedOrder: string[] | undefined,
  columnName: string
): string[] | undefined {
  if (!savedOrder || savedOrder.length === 0) return savedOrder;
  return savedOrder.filter((id) => id !== columnName);
}

export function renameCustomFieldKey(
  customFields: Record<string, string>,
  oldName: string,
  newName: string
) {
  if (!(oldName in customFields)) return;
  customFields[newName] = customFields[oldName];
  delete customFields[oldName];
}

// ── Column mutations shared by the board and the network ──────────────────

/** A document that carries custom columns (a board or a network). */
export interface ColumnDoc {
  columns: Column[];
  columnOrder?: string[];
}

/** A row that stores custom column values (a job or a person). */
export interface CustomFieldRow {
  customFields: Record<string, string>;
}

function findColumnIndex(columns: Column[], name: string): number {
  const lower = name.trim().toLowerCase();
  return columns.findIndex((c) => c.name.toLowerCase() === lower);
}

/** Validate and add a custom column, seeding its default value on every row. */
export function addCustomColumn(
  doc: ColumnDoc,
  rows: CustomFieldRow[],
  input: unknown,
  kind: ColumnKind
): Outcome<Column> {
  const error = getColumnValidationError(input, kind);
  if (error) return fail(400, error);
  const column = sanitizeColumn(input as Column);

  if (doc.columns.length >= MAX_COLUMNS) {
    return fail(400, `You can have up to ${MAX_COLUMNS} custom columns`);
  }
  if (findColumnIndex(doc.columns, column.name) !== -1) {
    return fail(409, 'A column with this name already exists');
  }

  doc.columns.push(column);
  const defaultValue = column.type === 'checkbox' ? 'No' : '';
  for (const row of rows) {
    if (!(column.name in row.customFields)) row.customFields[column.name] = defaultValue;
  }
  return ok(column);
}

/** Validate and replace the column called `oldName`, renaming stored values if the name changed. */
export function updateCustomColumn(
  doc: ColumnDoc,
  rows: CustomFieldRow[],
  oldName: string,
  input: unknown,
  kind: ColumnKind
): Outcome<Column> {
  const index = findColumnIndex(doc.columns, oldName);
  if (index === -1) return fail(404, 'Column not found');

  const error = getColumnValidationError(input);
  if (error) return fail(400, error);
  const column = sanitizeColumn(input as Column);

  const previous = doc.columns[index];
  const renamed = previous.name !== column.name;
  // Reserved names are only checked on rename, so an older column that already carries one can
  // still have its type or options edited.
  if (renamed && isReservedColumnName(column.name, kind)) {
    return fail(400, `"${column.name}" is a built-in column name — pick another`);
  }
  if (
    renamed &&
    doc.columns.some((c, i) => i !== index && c.name.toLowerCase() === column.name.toLowerCase())
  ) {
    return fail(409, 'A column with this name already exists');
  }

  doc.columns[index] = column;
  if (renamed) {
    for (const row of rows) renameCustomFieldKey(row.customFields, previous.name, column.name);
    doc.columnOrder = renameColumnInOrder(doc.columnOrder, previous.name, column.name);
  }
  return ok(column);
}

/** Remove the column called `name` and its values from every row. */
export function removeCustomColumn(
  doc: ColumnDoc,
  rows: CustomFieldRow[],
  name: string
): Outcome<Column> {
  const index = findColumnIndex(doc.columns, name);
  if (index === -1) return fail(404, 'Column not found');

  const [removed] = doc.columns.splice(index, 1);
  doc.columnOrder = removeColumnFromOrder(doc.columnOrder, removed.name);
  for (const row of rows) delete row.customFields[removed.name];
  return ok(removed);
}

/** Reorder the custom columns; `order` must list every existing custom column exactly once. */
export function reorderCustomColumns(doc: ColumnDoc, order: unknown): Outcome<Column[]> {
  if (!Array.isArray(order) || order.some((name) => typeof name !== 'string')) {
    return fail(400, 'columnOrder must be an array of column names');
  }
  const byName = new Map(doc.columns.map((c) => [c.name, c]));
  if (order.length !== byName.size || new Set(order).size !== order.length) {
    return fail(400, 'columnOrder must list every custom column once');
  }
  for (const name of order) {
    if (!byName.has(name)) return fail(400, `Column "${name}" not found`);
  }
  doc.columns = order.map((name) => byName.get(name)!);
  return ok(doc.columns);
}

/** Column-order payloads (built-in ids plus custom names) — unknown ids are dropped on read. */
export function getColumnOrderError(order: unknown): string | null {
  if (!Array.isArray(order)) return 'columnOrder must be an array';
  if (order.length > 200) return 'columnOrder is too long';
  if (order.some((id) => typeof id !== 'string' || id.length > COLUMN_NAME_MAX + 1)) {
    return 'columnOrder must contain column ids';
  }
  return null;
}
