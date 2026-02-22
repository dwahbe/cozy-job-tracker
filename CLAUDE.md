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

## Project structure

```
app/
├── (app)/           # Authenticated routes: /board, /settings, /trash
├── (public)/        # Public routes: /, /login, /changelog, /data-policy, /b/[slug]
├── api/
│   ├── [transport]/ # MCP server endpoint (Streamable HTTP)
│   ├── extension/   # Chrome extension API (add-job, board, me, parse-job, etc.)
│   ├── oauth/       # OAuth token + revoke endpoints
│   └── well-known/  # OAuth discovery metadata (rewritten from /.well-known/)
├── oauth/authorize/ # OAuth consent page + server action
├── components/      # Shared React components
├── globals.css      # Tailwind v4 + custom design system
├── layout.tsx       # Root layout
lib/
├── kv.ts            # Data types (Job, Board, SortRule) and KV access
├── dal.ts           # Data access layer, verifySession()
├── api-auth.ts      # API route auth helpers (resolveBoard, saveBoardAndRevalidate)
├── oauth.ts         # OAuth helpers (PKCE, tokens, client metadata)
├── extension-auth.ts # Chrome extension token validation
├── extractJob.ts    # AI job extraction (OpenAI)
├── markdown.ts      # Column type definition, re-exported by kv.ts
auth.ts              # NextAuth config (Resend provider, Upstash adapter)
proxy.ts             # Middleware for route protection
extension/           # Chrome extension source (separate package)
```

## Architecture

- **Server Components** by default; `'use client'` only for interactivity
- **API routes** follow: try/catch, `resolveBoard()` for auth, `saveBoardAndRevalidate()` for writes, explicit `runtime = 'nodejs'`
- **Auth**: NextAuth v5 beta with Resend magic links. `verifySession()` in `lib/dal.ts` protects server components (redirects to `/login`). `resolveBoard()` in `lib/api-auth.ts` protects API routes
- **Database**: Vercel KV (Upstash Redis). No ORM — direct KV with typed helpers in `lib/kv.ts`. Keys: `board:{userId}` (auth) or `board:{slug}` (legacy)
- **State**: React hooks only (no Redux/Zustand). Optimistic updates with rollback. `useLocalStorage` hook with cross-tab sync
- **AI**: OpenAI gpt-4o-mini parses job URLs into structured data (`lib/extractJob.ts`)
- **MCP**: Remote MCP server at `/api/mcp` (Streamable HTTP via `mcp-handler`). OAuth 2.1 auth flow with PKCE — users authorize via a consent page, tokens stored in Redis. Tools: `list_jobs`, `get_job`, `add_job`, `update_job`, `delete_job`, `search_jobs`, `get_board_summary`, `parse_job_url`
- **Chrome extension**: Separate package in `extension/`. Communicates via `/api/extension/*` routes, authenticated with extension tokens (`lib/extension-auth.ts`)
- **Legacy boards**: slug-based with optional PIN protection, being migrated to auth-based

## Data model

Core types in `lib/kv.ts` (Column defined in `lib/markdown.ts`, re-exported):

- **Job**: `id`, `title`, `company`, `link`, `location`, `employmentType`, `notes`, `status`, `dueDate`, `parsedOn`, `verified`, `customFields`
- **TrashedJob**: extends Job with `deletedAt` (auto-pruned after 30 days)
- **SortRule**: `field`, `direction` ('asc' | 'desc')
- **Board**: `title`, `columns`, `columnOrder`, `sortPreference: SortRule[]`, `jobs[]`, `trash[]`, `pin`, `migratedTo?`, `migratedAt?`
- **Column**: `name`, `type` ('text' | 'checkbox' | 'dropdown'), `options`, `optionColors`

OAuth keys in Redis (defined in `lib/oauth.ts`):

- `oauth:code:{code}` — short-lived auth code (10 min TTL)
- `oauth:access:{token}` — access token (90 day TTL)
- `oauth:refresh:{token}` — refresh token (1 year TTL)

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

## Pre-deploy checklist

1. `bun run lint`
2. `bun tsc --noEmit`
3. `bun run build`
4. `bun run format`

## Environment variables

- `KV_REST_API_URL` — Upstash Redis URL
- `KV_REST_API_TOKEN` — Upstash Redis token
- `OPENAI_API_KEY` — OpenAI API key
- `AUTH_SECRET` — NextAuth secret
- `EMAIL_FROM` — Resend sender (optional, defaults to onboarding@resend.dev)
