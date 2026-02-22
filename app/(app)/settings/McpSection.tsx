'use client';

import { useState } from 'react';

const MCP_URL = 'https://cozyjobtracker.com/api/mcp';

export function McpSection({ sessionToken }: { sessionToken: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!sessionToken) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-2">MCP server</h2>
        <p className="muted text-sm">Session token unavailable. Try signing out and back in.</p>
      </div>
    );
  }

  const fullUrl = `${MCP_URL}?token=${sessionToken}`;

  async function copyUrl() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-1">MCP server</h2>
      <p className="muted text-sm mb-4">
        Connect your job board to AI assistants like Claude or ChatGPT.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm muted mb-1.5">MCP server URL</label>
          <div className="flex items-center gap-2">
            <code className="input flex-1 text-xs font-mono truncate py-2 px-3">{fullUrl}</code>
            <button type="button" onClick={copyUrl} className="btn text-sm shrink-0">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="muted text-xs space-y-1.5">
          <p>
            Paste this URL into Claude Desktop&apos;s &quot;Add custom connector&quot; dialog (or
            any MCP-compatible client).
          </p>
          <p>
            The token is tied to your browser session and expires when you sign out. You&apos;ll
            need to copy a new URL if that happens.
          </p>
        </div>
      </div>
    </div>
  );
}
