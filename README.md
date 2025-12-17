# cozy job tracker 🌱

calm tracking for a noisy job search.

paste a job url, let AI parse it, and keep everything organized in one cozy spot. no spreadsheet gymnastics required.

## what it does

- **ai-powered parsing** — drop in a job url and watch it extract title, company, location, salary, and more
- **stress-free tracking** — move jobs through your pipeline: saved → applied → interview → offer
- **custom columns** — add whatever fields make sense for your search (referral? vibe check? notes to self?)
- **share with friends** — send your board to a friend who's also in the thick of it

## get started

```bash
# install
bun install

# set up your openai key
cp .env.example .env.local
# add your OPENAI_API_KEY to .env.local

# run it
bun dev
```

then visit [localhost:3000](http://localhost:3000) and create your first board.

## environment variables

```
OPENAI_API_KEY=sk-your-key-here
```

## deploying

works great on vercel:

```bash
vercel
```

just add your `OPENAI_API_KEY` in vercel's environment variables.

**note:** uses vercel kv for storage in production. file-based storage works locally.

## limitations

- javascript-heavy job sites might not parse well (looking at you, greenhouse iframes)
- no auth — share the url, share the board
- built for personal use, not high-traffic scenarios

## license

MIT — do whatever you want with it.

---

📬 send this to your unemployed friend
