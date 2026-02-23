# CLAUDE.md

## Project overview

cozy job tracker — a calm job search tracking app. Next.js App Router, TypeScript, Tailwind CSS, Vercel KV (Upstash Redis), NextAuth v5 magic link auth. Deployed on Vercel at https://cozyjobtracker.com.

## Commands

```bash
bun run dev          # Dev server (Turbopack)
bun run build        # Production build
bun run lint         # ESLint
bun tsc --noEmit     # Type check
bun run format       # Prettier format all
bun run format:check # Prettier check
```

## Verification

After making changes, always run:

```bash
bun run lint && bun tsc --noEmit
```

For UI changes, run `bun run dev` and verify in the browser. There is no test suite.

## Pre-deploy checklist

1. `bun run lint`
2. `bun tsc --noEmit`
3. `bun run build`
4. `bun run format`

## Architecture

- **Server Components** by default; `'use client'` only for interactivity
- **API routes**: try/catch, `resolveBoard()` for auth, `saveBoardAndRevalidate()` for writes, explicit `runtime = 'nodejs'`
- **Auth**: NextAuth v5 beta with Resend magic links. `verifySession()` in `lib/dal.ts` protects server components (redirects to `/login`). `resolveBoard()` in `lib/api-auth.ts` protects API routes
- **Database**: Vercel KV (Upstash Redis). No ORM — direct KV with typed helpers in `lib/kv.ts`
- **State**: React hooks only (no Redux/Zustand). Optimistic updates with rollback
- **MCP**: Remote MCP server at `/api/[transport]` (Streamable HTTP). OAuth 2.1 with PKCE — see `lib/oauth.ts`
- **Chrome extension**: Separate package in `extension/`, communicates via `/api/extension/*` routes
- **Legacy boards**: slug-based with optional PIN, being migrated to auth-based

## Coding conventions

- **Imports**: absolute with `@/` prefix; separate `import type` from value imports
- **Components**: PascalCase filenames, interfaces for props
- **Styling**: Tailwind utilities + custom classes from `globals.css` (`.card`, `.btn`, `.input`, `.callout`, `.status-*`)
- **Formatting**: Prettier — single quotes, semicolons, 2-space indent, 100 char width, trailing comma es5
- **Lint**: ESLint with next/core-web-vitals + TypeScript; unused vars warn (ignores `^_`)
- **Path alias**: `@/*` → project root

## Voice & tone (for UI copy)

- Product name always lowercase: "cozy job tracker"
- First-person voice ("I" not "we")
- Friendly, casual, concise
- Sentence case everywhere

## Gotchas

- `proxy.ts` is the Next.js middleware file (not named `middleware.ts`)
- Two board key patterns in Redis: `board:{userId}` (auth) and `board:{slug}` (legacy)
- Data types live in `lib/kv.ts` with Column defined separately in `lib/markdown.ts`
