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
├── (public)/        # Public routes: /, /login, /changelog, /data-policy
├── api/             # REST API route handlers
├── components/      # Shared React components
├── globals.css      # Tailwind + custom design system
├── layout.tsx       # Root layout
lib/
├── kv.ts            # Data types (Job, Board, Column) and KV access
├── dal.ts           # Data access layer, verifySession()
├── api-auth.ts      # API route auth helpers (resolveBoard, saveBoardAndRevalidate)
├── actions.ts       # Server actions
auth.ts              # NextAuth config (Resend provider, Upstash adapter)
proxy.ts             # Middleware for route protection
```

## Architecture

- **Server Components** by default; `'use client'` only for interactivity
- **API routes** follow: try/catch, `resolveBoard()` for auth, `saveBoardAndRevalidate()` for writes, explicit `runtime = 'nodejs'`
- **Auth**: NextAuth v5 beta with Resend magic links. `verifySession()` in `lib/dal.ts` protects server components (redirects to `/login`). `resolveBoard()` in `lib/api-auth.ts` protects API routes
- **Database**: Vercel KV (Upstash Redis). No ORM — direct KV with typed helpers in `lib/kv.ts`. Keys: `board:{userId}` (auth) or `board:{slug}` (legacy)
- **State**: React hooks only (no Redux/Zustand). Optimistic updates with rollback. `useLocalStorage` hook with cross-tab sync
- **AI**: OpenAI gpt-4o-mini parses job URLs into structured data
- **Legacy boards**: slug-based with optional PIN protection, being migrated to auth-based

## Data model

Core types in `lib/kv.ts`:

- **Board**: `title`, `columns`, `columnOrder`, `sortPreference`, `jobs[]`, `trash[]`, `pin`
- **Job**: `id`, `title`, `company`, `link`, `location`, `employmentType`, `notes`, `status`, `dueDate`, `customFields`
- **TrashedJob**: extends Job with `deletedAt` (auto-pruned after 30 days)
- **Column**: `name`, `type` ('text' | 'checkbox' | 'dropdown'), `options`, `optionColors`

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
