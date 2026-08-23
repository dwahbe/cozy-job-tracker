import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

/**
 * Revalidate `paths` once the response has been sent, so writes don't pay for it. Outside a
 * request scope (where `after` throws synchronously) fall back to revalidating inline.
 */
export function scheduleRevalidate(paths: readonly string[]): void {
  const run = () => {
    for (const path of paths) revalidatePath(path);
  };
  try {
    after(run);
  } catch {
    run();
  }
}
