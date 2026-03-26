import type { Column } from '@/lib/markdown';

export const VALID_COLUMN_TYPES: Column['type'][] = ['text', 'checkbox', 'dropdown', 'date'];

export function getColumnValidationError(column: Column | null | undefined): string | null {
  if (!column || !column.name || !column.type) {
    return 'Column name and type are required';
  }

  if (!VALID_COLUMN_TYPES.includes(column.type)) {
    return `Column type must be one of: ${VALID_COLUMN_TYPES.join(', ')}`;
  }

  if (column.type === 'dropdown' && (!column.options || column.options.length === 0)) {
    return 'Dropdown columns require at least one option';
  }

  return null;
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
