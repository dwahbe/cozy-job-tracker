# AGENTS.md

## Project overview

cozy job tracker — a calm job search tracking app. Next.js App Router, TypeScript, Tailwind CSS, Upstash Redis (via `@upstash/redis`), NextAuth v5 magic link auth. Deployed on Vercel at https://cozyjobtracker.com.

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
- **API routes**: try/catch, `requireUserId()` (answer 401 when null), then `withBoard(userId, mutate)` / `withNetwork(userId, mutate)` for every write, explicit `runtime = 'nodejs'`. The mutator gets a freshly read document and returns `ok(value)` / `unchanged()` / `fail(status, message)` from `lib/outcome.ts`; `outcomeError()` turns a failure into the JSON response
- **Writes are compare-and-set**: `Board` and `NetworkData` carry a `version`; `lib/cas.ts` (one Lua script) only writes when the stored version matches, and `withBoard`/`withNetwork` re-read and re-run the mutator up to 3× on conflict, then revalidate the pages after the response (`lib/revalidate.ts`). Never `saveBoardByUserId()` after a read — that's the lost-update bug this replaced
- **Validation lives in one place**: `lib/job-updates.ts` (`applyJobUpdates`, `applyPersonUpdates`, `addManualJob`, `addPerson`, `logInteraction`) is shared by the web routes, the extension routes and the MCP tools — status enums, dropdown options, checkbox Yes/No, known custom columns, date formats, length caps from `lib/limits.ts`. Column shape/reserved-name rules are in `lib/custom-column-utils.ts`
- **Auth**: NextAuth v5 beta with Resend magic links (database sessions). `verifySession()` in `lib/dal.ts` protects server components (redirects to `/login`); `requireUserId()` in `lib/api-auth.ts` protects API routes; `validateExtensionToken()` in `lib/extension-auth.ts` protects `/api/extension/*`
- **Database**: Upstash Redis through the single client in `lib/redis.ts` (constructed from `KV_REST_API_URL`/`KV_REST_API_TOKEN`). No ORM — typed helpers in `lib/kv.ts` (board) and `lib/network-store.ts` (network; `lib/network.ts` holds the network types and pure helpers that client components import, so it must never touch Redis); `lib/users.ts` lists/counts users. Reads fall back to an empty document (`getBoardOrDefault` / `getNetworkOrDefault`) without writing — the first compare-and-set write creates the key
- **Rate limits**: `lib/ratelimit.ts` (`@upstash/ratelimit`, fail-open) — `parse` per user (60/10 min, enough for a full 50-URL bulk import, + 300/day; windows checked in order so a burst block doesn't spend a daily token) on every OpenAI-backed route and MCP tool, `signin` per IP in `proxy.ts`, `sheet` per user on the sheet import
- **Outbound fetches**: `lib/safe-url.ts` refuses private/loopback/link-local hosts and non-http(s) schemes; `lib/fetchPage.ts` follows redirects by hand (≤5 hops, guard re-run per hop, one 10 s timeout for the whole chain) and caps bodies at 2 MB
- **Security headers** (CSP report-only, nosniff, frame-ancestors, referrer/permissions policies) and the `/b/:slug*` → `/login` redirect live in `next.config.ts`
- **State**: React hooks only (no Redux/Zustand). Optimistic updates with rollback; failed edits surface through `showToast()` (`app/components/Toast.tsx`) or inline errors
- **MCP**: Remote MCP server at `/api/[transport]` (Streamable HTTP). OAuth 2.1 with PKCE — see `lib/oauth.ts`; mutating tools require the `board:write` scope
- **Chrome extension**: Separate package in `extension/`, communicates via `/api/extension/*` routes (`extension/dist` is built output and not tracked)

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
- `proxy.ts` only checks for a session cookie on protected routes, handles `/login` redirects (with `callbackUrl`) and rate-limits `POST /api/auth/signin/*`; real session validation is `verifySession()` (pages) / `requireUserId()` (API routes)
- Board data lives at `board:{userId}` and network data at `network:{userId}` (one JSON blob each, `version` field, compare-and-set writes via `withBoard`/`withNetwork` — a plain `set` clobbers concurrent edits)
- Data types live in `lib/kv.ts` (board) and `lib/network.ts` (network) with Column defined separately in `lib/markdown.ts`
- `.env.local` points at the production Redis — anything you run locally (scripts, `next start`) touches real data
- Custom columns can't reuse built-in field names (`isReservedColumnName`); the rule is checked client-side in the column managers and server-side on add/rename
- `agentRules: false` in `next.config.ts` is deliberate (keeps `next dev` from appending to AGENTS.md); AGENTS.md is a copy of this file with a different title — keep them in sync
