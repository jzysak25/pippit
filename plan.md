# Pippit — Project Plan

**Personal Party Transfer marketplace, powered by AI**

---

## What It Is

A CLI app where users talk to an AI agent to buy and sell items locally or with shipping — like Craigslist or Facebook Marketplace, but entirely conversational. No listing browser, no search bar. You tell the agent what you want or what you're selling, and it handles everything.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Type safety, great Ink/Node ecosystem |
| CLI UI | Ink (React for terminal) | Composable, stateful, idiomatic TS |
| AI Agent | Claude API — `claude-haiku-4-5` (default), `claude-sonnet-4-6` (complex flows) | Native tool use, fast haiku for snappy UX |
| API Key | BYOK — user provides their own Anthropic API key | Pippit never pays for inference; key stored locally only |
| ORM | Drizzle | Lightweight, fully type-safe, easy migration path |
| Database | Turso (hosted libSQL) | Networked SQLite, zero infra, multi-user from day one |
| Auth | JWT stored in `~/.pippit/config.json` | Works for CLI now, cookie-portable for web later |
| Key storage | `~/.pippit/config.json` (local only, never sent to Pippit DB) | User retains full control of their key |
| Monorepo | pnpm workspaces | Shared `core` package across CLI and future web |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Transport Layer                      │
│                                                          │
│   packages/cli  (Ink)          packages/web  (future)    │
│   - renders chat UI            - Next.js / React         │
│   - reads stdin                - streams via SSE/WS      │
│   - local JWT config           - JWT via HTTP cookie     │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│                      packages/core                       │
│                                                          │
│   agentTurn(userId, message, history) → response         │
│                                                          │
│   agent/                                                 │
│     index.ts      — main loop, tool execution            │
│     tools.ts      — tool definitions + handlers          │
│     prompts.ts    — system prompt builder                │
│     state.ts      — ConversationState type               │
│                                                          │
│   db/                                                    │
│     schema.ts     — Drizzle schema                       │
│     client.ts     — Turso connection                     │
│     queries/      — listings, users, offers, messages    │
│                                                          │
│   auth/                                                  │
│     tokens.ts     — JWT sign / verify                    │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
                    Turso (hosted libSQL)
                    — shared by all clients
```

**Rule:** `agentTurn()` has no knowledge of how it is called. It receives messages, returns messages. The CLI and future web interface are thin wrappers.

---

## BYOK (Bring Your Own Key)

Pippit uses the user's own Anthropic API key. Pippit supplies all prompts, tools, and logic — the key is purely for billing.

### Why BYOK
- Pippit bears zero inference cost
- Users have full visibility and control over their own API spend
- No payment infrastructure needed on Pippit's side
- Anthropic's free tier / existing accounts make onboarding easy

### Key Storage
The API key lives only in `~/.pippit/config.json` on the user's machine. It is **never** sent to the Pippit database or any Pippit server.

```json
{
  "jwt": "...",
  "anthropicApiKey": "sk-ant-...",
  "preferredModel": "claude-haiku-4-5"
}
```

### Setup Flow (first run)
On first launch, before any marketplace interaction, the agent runs a one-time setup:

```
[pippit]  Welcome to Pippit! To get started, I need your Anthropic API key.
          You can get one at console.anthropic.com.
          Your key is stored locally and never shared.

> sk-ant-...

[pippit]  Got it. Your key is saved. Now let's set up your account.
          What username do you want?
```

After key entry, flow continues into register/login. The key is validated by making a lightweight test call before saving.

### Model Selection
Default model: `claude-haiku-4-5` (fast, cheap — good for marketplace chatter).
Users can switch to `claude-sonnet-4-6` for more complex reasoning via a `/model` command or agent preference.

```ts
// core/src/agent/index.ts
function agentTurn(userId, message, history, config: { apiKey: string, model: string }) {
  const client = new Anthropic({ apiKey: config.apiKey });
  // ...
}
```

### For Web Interface (future)
Web users provide their key via an onboarding form. It is stored in their browser's localStorage or a secure server-side session — never persisted in Pippit's DB.

---

## Project Structure

```
pippit/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   │   ├── index.ts        # agentTurn()
│   │   │   │   ├── tools.ts        # tool schemas + handlers
│   │   │   │   ├── prompts.ts      # system prompt builder
│   │   │   │   └── state.ts        # ConversationState
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── client.ts
│   │   │   │   └── queries/
│   │   │   │       ├── listings.ts
│   │   │   │       ├── users.ts
│   │   │   │       ├── offers.ts
│   │   │   │       └── messages.ts
│   │   │   └── auth/
│   │   │       └── tokens.ts
│   │   └── package.json
│   │
│   └── cli/
│       ├── src/
│       │   ├── index.ts            # entry point
│       │   ├── App.tsx             # root Ink component
│       │   ├── components/
│       │   │   ├── ChatThread.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   ├── InputBox.tsx
│       │   │   └── ListingCard.tsx
│       │   └── session.ts          # ~/.pippit/config.json
│       └── package.json
│
├── drizzle/
│   └── migrations/
├── drizzle.config.ts
└── package.json                    # pnpm workspaces root
```

---

## Data Model

### users
```
id            text  primary key
username      text  unique not null
email         text  unique not null
password_hash text  not null
location      text
preferences   text  (JSON — see Agent Memory)
created_at    integer
```

### listings
```
id               text  primary key
seller_id        text  → users.id
title            text  not null
description      text
category         text
price            integer  (cents)
condition        text  (new | like_new | good | fair | parts)
location         text
lat              real
lng              real
delivery_options text  (pickup | shipping | both)
status           text  (active | sold | removed)
created_at       integer
updated_at       integer
```

### wanted_requests
```
id                   text  primary key
buyer_id             text  → users.id
description          text  not null
category             text
max_budget           integer  (cents)
location             text
radius_km            real
delivery_preference  text  (pickup | shipping | either)
status               text  (open | fulfilled | cancelled)
created_at           integer
```

### offers
```
id             text  primary key
listing_id     text  → listings.id
buyer_id       text  → users.id
amount         integer  (cents)
message        text
status         text  (pending | accepted | declined | countered)
counter_amount integer
created_at     integer
```

### messages
```
id           text  primary key
from_user_id text  → users.id
to_user_id   text  → users.id
listing_id   text  → listings.id
body         text  not null
read_at      integer
created_at   integer
```

---

## Agent Design

### Conversation State Machine

The agent maintains an explicit mode per session (in-memory). Current mode is injected into the system prompt each turn.

```
idle
  → gather_sell        user wants to list an item
  → gather_buy         user wants to find or request an item
  → viewing_results    search results shown, awaiting action
  → negotiating        offer in flight
  → messaging          direct thread with another user
  → manage_listings    viewing / editing / removing own listings
  → manage_offers      offers sent or received
```

### System Prompt (3 sections, built dynamically)

**1. Persona + rules (static)**
- Agent is Pippit's marketplace assistant
- Be concise, never fabricate listings or prices
- Only call tools when enough info is gathered — ask for missing fields first
- Show listings with: title, price, condition, location, delivery

**2. User context (dynamic per session)**
- Username, location, saved preferences
- Unread notification count — summarize at session start

**3. Conversation state (dynamic per turn)**
- Current mode
- In-progress draft (partial listing or buy request) if any

### Information Gathering

Progressive disclosure — never ask all questions at once:
1. Ask for the most critical field first
2. Infer from saved preferences (skip asking for location if already saved)
3. Ask for remaining required fields one at a time
4. Confirm full summary before writing to DB

**Sell required fields:** title, category, price, condition, location, delivery options
**Buy required fields:** what they want, max budget, location

### Agent Memory (Cross-Session)

Stored as JSON in `users.preferences`:

```ts
{
  defaultLocation: string,
  defaultDeliveryPreference: 'pickup' | 'shipping' | 'either',
  typicalBudgetByCategory: Record<string, number>,
  preferredCategories: string[],
  communicationStyle: 'brief' | 'detailed',
  lastSeenAt: string,
}
```

The agent updates preferences automatically when it detects natural-language signals:
- "I usually prefer pickup" → updates `defaultDeliveryPreference`
- "I'm typically under $300 for electronics" → updates `typicalBudgetByCategory`

### Tools

**Listings**
```
searchListings(query, filters: { category, maxPrice, location, radiusKm, deliveryOption })
createListing(title, description, category, price, condition, location, deliveryOptions)
updateListing(listingId, changes)
closeListing(listingId, reason: 'sold' | 'removed')
getMyListings()
```

**Wanted requests**
```
createWantedRequest(description, category, maxBudget, location, radiusKm, deliveryPreference)
getMyWantedRequests()
closeWantedRequest(requestId)
findMatchingWantedRequests(listingId)   // called after createListing, notifies buyers
```

**Offers**
```
makeOffer(listingId, amount, message?)
respondToOffer(offerId, action: 'accept' | 'decline' | 'counter', counterAmount?)
getMyOffers()
getOffersOnMyListings()
```

**Messaging**
```
sendMessage(toUserId, listingId, body)
getThread(listingId, otherUserId)
getInbox()
markRead(messageId)
```

**User / preferences**
```
getUserProfile()
updatePreferences(prefs)
getNotifications()
```

All tools return structured JSON. Claude synthesizes results into natural language. Raw JSON is never shown to the user.

### Search Strategy

- **Phase 1**: SQL full-text search (FTS5 on Turso) + structured filters (category, price, location)
- **Phase 2**: Vector embeddings for semantic search — "something for camping" matches tent, sleeping bag, etc.
- **Phase 3**: Proactive matching — `findMatchingWantedRequests` runs on every new listing, notifies interested buyers

---

## Ink UI

```
┌──────────────────────────────────────────┐
│  pippit  ·  logged in as joelz           │
├──────────────────────────────────────────┤
│                                          │
│  [pippit]  Hey Joel! What are you        │
│  looking to do — buy or sell?            │
│                                          │
│  [you]  I want to sell my road bike      │
│                                          │
│  [pippit]  Nice. What condition is it    │
│  in and how much are you asking?         │
│                                          │
│  [you]  Good condition, asking $280      │
│                                          │
│  [pippit]  Got it. Pickup only or        │
│  open to shipping?                       │
│                                          │
├──────────────────────────────────────────┤
│  > _                                     │
└──────────────────────────────────────────┘
```

**Components**
- `ChatThread` — scrollable message list
- `MessageBubble` — agent vs. user styling (color-coded)
- `InputBox` — text input, submit on Enter, up-arrow history
- `ListingCard` — structured listing display inline in chat
- `Spinner` — while agent calls API or DB

---

## Phases

### Phase 1 — MVP

- [ ] pnpm monorepo, `core` + `cli` packages scaffolded
- [ ] Turso DB + Drizzle schema + migrations
- [ ] First-run setup: prompt for Anthropic API key, validate, save to `~/.pippit/config.json`
- [ ] Auth: register/login via agent conversation, JWT in `~/.pippit/config.json`
- [ ] Agent core: `agentTurn()`, state machine, system prompt builder, tool loop
- [ ] Tools: searchListings, createListing, createWantedRequest, makeOffer, getMyListings, getInbox, updatePreferences
- [ ] Ink UI: chat thread, input box, spinner, listing card
- [ ] Session startup: load prefs + unread notifications, greet user
- [ ] Preference memory: auto-update from natural language signals

### Phase 2 — Full Marketplace

- [ ] Offer negotiation: counter-offers, accept/decline flow
- [ ] In-app messaging thread between buyer and seller
- [ ] Proactive buyer matching on new listings
- [ ] Listing expiry + renewal prompts
- [ ] Semantic search via embeddings

### Phase 3 — Web Interface

- [ ] `packages/web` — Next.js app, imports `core` package
- [ ] Streaming agent responses (SSE)
- [ ] Ratings and reputation system
- [ ] Moderation: agent flags suspicious listings
