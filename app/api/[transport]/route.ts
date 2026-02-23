import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { validateAccessToken } from '@/lib/oauth';
import { toolDefinitions } from './tools';

export const runtime = 'nodejs';

const handler = createMcpHandler(
  (server) => {
    for (const tool of toolDefinitions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).registerTool(tool.name, tool.config, tool.handler);
    }
  },
  { serverInfo: { name: 'cozy-job-tracker', version: '0.1.0' } },
  { basePath: '/api', disableSse: true, verboseLogs: true }
);

const authedHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;

    const tokenData = await validateAccessToken(bearerToken);
    if (!tokenData) return undefined;

    return {
      token: bearerToken,
      clientId: tokenData.clientId,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      extra: { userId: tokenData.userId },
    };
  },
  { required: true }
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
