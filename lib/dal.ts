import 'server-only';
import { cache } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

/**
 * Verify the user's session. Redirects to /login if not authenticated.
 * Uses React cache() to dedupe within a single render pass.
 */
export const verifySession = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return { userId: session.user.id, email: session.user.email!, name: session.user.name || null };
});

/**
 * Get session without redirecting (returns null if not authenticated).
 */
export const getSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { userId: session.user.id, email: session.user.email!, name: session.user.name || null };
});
