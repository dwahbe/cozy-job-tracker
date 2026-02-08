/**
 * Preset color palette for custom dropdown options.
 * Each key maps to a `.dropdown-{key}` CSS class defined in globals.css.
 */

export const DROPDOWN_COLORS = [
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;

export type DropdownColor = (typeof DROPDOWN_COLORS)[number];

/** Map of color key -> display label */
export const DROPDOWN_COLOR_LABELS: Record<DropdownColor, string> = {
  gray: 'Gray',
  brown: 'Brown',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
};

/** Map of color key -> swatch hex (for the picker dots, slightly richer than bg for visibility) */
export const DROPDOWN_COLOR_SWATCHES: Record<DropdownColor, string> = {
  gray: '#9c9689',
  brown: '#b07a42',
  red: '#d4594f',
  orange: '#d97a3e',
  yellow: '#c9a022',
  green: '#3ea85e',
  teal: '#3aaa9c',
  blue: '#5b86d6',
  purple: '#8e6abf',
  pink: '#d66a9e',
};

/**
 * Returns the CSS class name for a dropdown color key.
 * Returns empty string if no color is set.
 */
export function dropdownColorClass(color?: string): string {
  if (!color) return '';
  return `dropdown-${color}`;
}
