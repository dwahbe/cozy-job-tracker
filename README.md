# cozy job tracker 🌱

Calm tracking for a noisy job search.

I built this because job hunting is stressful enough without fighting your tracking tool. Paste a job url, it pulls the details, and you get a clean board to track everything. That's basically it.

## what it does

- **auto parsing** — paste a job url and it extracts title, company, location, salary, type — all of it
- **bulk import** — paste up to 50 urls and import them all at once. no more adding jobs one by one
- **board, table & card views** — drag jobs through your pipeline: saved → applied → interview → offer
- **custom columns** — add whatever fields make sense for your search (referral? vibe check? notes to self?)
- **notes & due dates** — keep track of deadlines and details without a separate app
- **network tab** — the people side of the search: contacts, statuses, follow-ups, and who's linked to which job (with a Google Sheets import)
- **chrome extension** — save the posting you're looking at without leaving the tab ([web store](https://chromewebstore.google.com/detail/cozy-job-tracker/jnkjaboanaihkoiidmpjolldkgkbpllm))
- **ai assistants** — connect Claude (or any MCP client) to your board and manage it from a chat

No AI cover letter generators, no LinkedIn integrations, no "career coaching." just a clean board for keeping track of where you applied.

## stack

next.js (app router) · react · tailwind · upstash redis (one json blob per user, compare-and-set writes) · nextauth magic links via resend · openai for parsing · upstash ratelimit · remote mcp server with oauth 2.1 (pkce) · deployed on vercel

## running it

```bash
bun install
bun run dev
```

You'll need `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash Redis), `AUTH_SECRET`, `AUTH_RESEND_KEY` + `EMAIL_FROM`, and `OPENAI_API_KEY` in `.env.local`. `bun run lint && bun tsc --noEmit && bun run build` before shipping; there's no test suite.

## license

MIT — please give credit when appropriate :)

---

📬 Send this to your unemployed friends
