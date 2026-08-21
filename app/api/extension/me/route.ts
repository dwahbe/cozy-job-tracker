import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionToken } from '@/lib/extension-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await validateExtensionToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
  });
}
