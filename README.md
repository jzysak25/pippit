# Pippit

An AI-powered peer-to-peer marketplace. Instead of browsing listings or filling out forms, you just talk to an AI agent — it handles buying, selling, negotiating, and messaging on your behalf.

Available as both a terminal app (Ink) and a web app (Next.js). Both share the same database and accounts.

---

## How it works

```
You: I want to sell my road bike
Pippit: Nice. What condition is it in and how much are you asking?
You: Good condition, $280
Pippit: Got it. Pickup only or open to shipping?
You: Either is fine
Pippit: Your listing is live! By the way, 2 people are already looking for road bikes — want me to message them?
```

The agent handles the full marketplace lifecycle: listing items, searching, making and countering offers, messaging other users, and tracking your active listings.

---

## Tech stack

| Layer | Choice |
|---|---|
| AI | Google Gemini (`gemini-3-flash-preview`) via `@google/genai` |
| API key | BYOK — your Google AI Studio key, stored locally only |
| Database | libSQL / Turso (falls back to local SQLite at `~/.pippit/data.db`) |
| ORM | Drizzle |
| CLI | Ink (React for terminals) |
| Web | Next.js 15, React 19 |
| Auth | scrypt password hashing, JWT stored locally |
| Monorepo | pnpm workspaces |

---

## Project structure

```
pippit/
├── packages/
│   ├── core/        # agentTurn(), DB queries, auth, tools
│   ├── cli/         # Ink terminal app
│   └── web/         # Next.js web app
├── drizzle.config.ts
└── plan.md
```

`packages/core` has no knowledge of how it's called — the CLI and web are thin wrappers around `agentTurn()`.

---

## Getting started

### Prerequisites

- Node.js 20+ (required for the web app; CLI works on 18.18+)
- pnpm (`npm install -g pnpm`)
- A free [Google AI Studio](https://aistudio.google.com) API key

### Install & build

```bash
git clone https://github.com/jzysak25/pippit
cd pippit
pnpm install
pnpm build
```

### Set up the database

```bash
npx drizzle-kit push
```

This creates `~/.pippit/data.db` (local SQLite). No Turso account needed for local development.

### Run the CLI

```bash
node packages/cli/dist/index.js
```

On first launch it will ask for your Google AI Studio API key, then walk you through registration or login.

### Run the web app

```bash
# requires Node 20+
cd packages/web && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Same setup flow as the CLI.

---

## What the agent can do

| Feature | Commands |
|---|---|
| Listings | Create, search, view, close, renew |
| Wanted requests | Post, view, close |
| Offers | Make, accept, reject, counter-offer |
| Messaging | Send messages, view threads (auto-marks read) |
| Preferences | Save location, delivery preference, budget by category |
| Proactive matching | Notifies you of interested buyers when you list an item |
| Expiry | Listings expire after 30 days; agent prompts renewal |

---

## Using Turso (optional)

For a shared, multi-user database set environment variables before running:

```bash
export TURSO_URL=libsql://your-db.turso.io
export TURSO_AUTH_TOKEN=your-token
```

Then re-run `npx drizzle-kit push` to push the schema to Turso.

---

## Development

```bash
pnpm build          # build core + cli
pnpm --filter @pippit/web dev   # web dev server (Node 20+)
npx drizzle-kit push            # sync schema changes to DB
```

The CLI and web app share `~/.pippit/data.db` locally, so accounts and listings created in one are visible in the other.
