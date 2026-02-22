import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { Redis } from '@upstash/redis';
import { toolDefinitions } from './tools';

export const runtime = 'nodejs';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface RedisSession {
  userId: string;
  expires: string;
}

async function resolveUserId(token: string): Promise<string | null> {
  const session = await redis.get<RedisSession>(`user:session:${token}`);
  if (!session || new Date(session.expires) < new Date()) return null;
  return session.userId;
}

const handler = createMcpHandler(
  (server) => {
    for (const tool of toolDefinitions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).registerTool(tool.name, tool.config, tool.handler);
    }
  },
  { serverInfo: { name: 'cozy-job-tracker', version: '0.1.0' } },
  { basePath: '/api', disableSse: true }
);

const authedHandler = withMcpAuth(
  handler,
  async (req, bearerToken) => {
    const token = bearerToken ?? new URL(req.url).searchParams.get('token') ?? undefined;
    if (!token) return undefined;

    const userId = await resolveUserId(token);
    if (!userId) return undefined;

    return { token, clientId: userId, scopes: [], extra: { userId } };
  },
  { required: true }
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
