import { cookies } from 'next/headers';
import { verifySession } from '@/lib/dal';
import { getBoardByUserId } from '@/lib/kv';
import { SignOutButton } from './SignOutButton';
import { BoardTitleForm } from './BoardTitleForm';
import { NameForm } from './NameForm';
import { McpSection } from './McpSection';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { userId, email, name } = await verifySession();
  const board = await getBoardByUserId(userId);
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('__Secure-authjs.session-token')?.value ||
    cookieStore.get('authjs.session-token')?.value ||
    null;

  return (
    <main className="page">
      <div className="container-app max-w-2xl">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Account */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Account</h2>
            <div className="space-y-4">
              <NameForm currentName={name} />
              <div>
                <label className="block text-sm muted mb-1">Email</label>
                <p className="font-medium">{email}</p>
              </div>
            </div>
          </div>

          {/* Board Settings */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Board</h2>
            <BoardTitleForm currentTitle={board?.title || 'My job board'} />
          </div>

          {/* AI Integration */}
          <McpSection sessionToken={sessionToken} />

          {/* Sign Out */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Session</h2>
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}

export function generateMetadata() {
  return {
    title: 'Settings - cozy job tracker',
  };
}
