# AInstant

AI news aggregation: fetch many sources, drop duplicates, label with an LLM, group into events, rank by heat.
This repo currently holds the ingestion pipeline. The website (Next.js), newsletter and admin come next.

## Pipeline

Each run (every 10 minutes on Railway Cron) does:

1. **Ingest** (`src/pipeline/ingest.ts`): every enabled source in `config/sources.ts` is fetched by its adapter in `src/sources/`.
   General sources (HN, GitHub Trending, ...) go through a keyword prefilter (`config/keywords.ts`) before any LLM cost.
   URLs are canonicalized and hashed (`src/lib/url.ts`); a URL already seen from another source becomes a *mention*, which counts toward heat.
2. **Classify** (`src/pipeline/classify.ts`): Claude Haiku labels each new item: keep or reject (not AI, funding, policy, low signal),
   category, type, tags, timeline role (announcement, early test, criticism, official response, follow-up), fact/allegation/opinion,
   a rewritten one-sentence English summary, and entity names.
3. **Embed**: Voyage multilingual embeddings, so Chinese and English posts about the same release land together.
4. **Cluster** (`src/pipeline/cluster.ts`): join the nearest active event when very similar; ask the LLM when moderately similar and sharing a name; otherwise start a new event.
5. **Headline** (`src/pipeline/events.ts`): events that changed get a neutral headline and "why it matters". Events with criticism or allegations go to `pending_review` and stay off the front page until approved.
6. **Rank** (`src/pipeline/rank.ts`): heat = source weights × platform diversity × log engagement × time decay (18 h half-life).

Sources pushed to us (the Grok bot watching X, manual submissions) land in the `inbox` table; `npm run submit` does the same by hand.

## Commands

```bash
npm install
npm test              # unit tests + end-to-end run on fixtures (in-memory Postgres, mock LLM)
npm run offline       # run the pipeline on fixtures and print the front page
npm run pipeline      # real run: needs .env (see .env.example)
npm run top           # print the current front page from the database
npm run submit -- https://x.com/... "title" [lang]
```

Without `DATABASE_URL` the pipeline uses a local PGlite database in `.pglite/` (Postgres + pgvector in WASM), so everything runs without a server.

## Deploy

- Database: create a Supabase project, enable the `vector` extension (the schema does `create extension if not exists vector`), set `DATABASE_URL`. The schema in `db/schema.sql` is applied on every run and is idempotent.
- Pipeline: a Railway service from this repo; `railway.json` sets the start command and a 10-minute cron. Set the variables from `.env.example`.

## Tuning after the first week of real data

- `thresholds` in `src/pipeline/brain.ts` (join / LLM check similarity) — look at wrongly merged or split events.
- Source weights in `config/sources.ts` and `HALF_LIFE_H` in `src/pipeline/rank.ts`.
- RSS URLs marked `verify` in `config/sources.ts`; failing sources show up in `sources.last_error`.
