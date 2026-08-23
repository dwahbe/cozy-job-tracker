/**
 * Result of a mutation run against a freshly read document (see withBoard / withNetwork).
 * Pure module so client components can share the validators that return it.
 */
export type Outcome<T = undefined> =
  { ok: true; value: T; changed: boolean } | { ok: false; status: number; error: string };

/** The mutation succeeded and the document should be written. */
export function ok<T = undefined>(value?: T): Outcome<T> {
  return { ok: true, value: value as T, changed: true };
}

/** The mutation succeeded but changed nothing — nothing is written. */
export function unchanged<T = undefined>(value?: T): Outcome<T> {
  return { ok: true, value: value as T, changed: false };
}

/** The mutation was rejected (validation, not found, …) — nothing is written. */
export function fail(status: number, error: string): Outcome<never> {
  return { ok: false, status, error };
}
