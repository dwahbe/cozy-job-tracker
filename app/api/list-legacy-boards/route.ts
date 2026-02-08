import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listImportableBoards } from '@/lib/kv';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const boards = await listImportableBoards();
  return NextResponse.json({ boards });
}
