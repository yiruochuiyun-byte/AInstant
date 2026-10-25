# AInstant

AI news aggregation (a Techmeme for AI): fetch many sources, drop duplicates, label with an LLM, group into events,
rank by heat, publish in English and Chinese, and mail a daily digest.

One repo, one `package.json`:

| Folder | What |
| --- | --- |
| `pipeline/` | Ingestion pipeline (Railway cron, every 10 min) and the daily digest (hourly) |
| `app/` | Next.js website (Vercel): `/en`, `/zh`, event pages, prices, subscribe, RSS, admin, `/api/ingest` |
| `lib/` | Shared code: database, LLM, embeddings, queries, i18n, email |
| `config/` | Sources, prefilter keywords, languages, glossary |
| `db/schema.sql` | Postgres schema (idempotent; applied by every pipeline run) |

## Pipeline (`pipeline/run.ts`)

1. **Ingest**: every enabled source in `config/sources.ts` is fetched by its adapter in `pipeline/sources/`.
   General sources (HN, GitHub Trending, ...) pass a keyword prefilter (`config/keywords.ts`) before any LLM cost.
   URLs are canonicalized and hashed (`lib/url.ts`); a URL already seen from another source becomes a *mention*, which counts toward heat.
2. **Classify**: Claude Haiku labels each new item: keep or reject (not AI, funding, policy, low signal), section, type, tags,
   timeline role (announcement, early test, criticism, official response, follow-up), fact/allegation/opinion,
   a rewritten one-sentence English summary and entity names.
3. **Embed**: Voyage multilingual embeddings, so Chinese and English posts about the same release land together.
4. **Cluster** (`pipeline/cluster.ts`): join the nearest active event when very similar; ask the LLM when moderately similar and sharing a name; otherwise start a new event.
5. **Headline** (`pipeline/events.ts`): changed events get a neutral headline and "why it matters". Events with criticism or allegations go to `pending_review` and stay off the site until approved in the admin. Headlines edited by a human are locked.
6. **Rank** (`pipeline/rank.ts`): heat = source weights × platform diversity × log engagement × time decay (18 h half-life).
7. **Translate** (`pipeline/translate.ts`): visible events and their timelines into each language in `config/site.ts`, with `config/glossary.json`; cached by source-text hash.

Pushed sources (the Grok bot watching X, admin submissions) land in the `inbox` table via `POST /api/ingest`
(`Authorization: Bearer $INGEST_TOKEN`, JSON `{url, title, note, author, lang}` or an array).

## Website

- `/en`, `/zh`: front page by heat, filters by section, type and tag. `/` redirects to `/en`; a banner offers the reader's browser language (no IP redirects). Every page has hreflang alternates; `sitemap.xml` lists all editions.
- `/[lang]/e/[slug]`: event timeline with source, role, fact/allegation/opinion and credibility labels, links to originals, public corrections log. X posts use X's embed only after the reader opts in.
- `/[lang]/prices`: OpenRouter prices and recent changes.
- `/[lang]/subscribe`: double opt-in; the digest goes out at 8:00 in the subscriber's time zone (`npm run digest`, hourly). One-click unsubscribe.
- `/[lang]/rss.xml` (`?category=models` for one section).
- `/admin` (HTTP basic auth, `ADMIN_PASSWORD`): review queue, approve/hide/pin, edit headline (logged publicly), split items into new events, merge events, source health, manual link submission.
- Sponsored placements come from the `sponsors` table (per language) and are always labelled.

## Commands

```bash
npm install
npm test              # unit tests + end-to-end pipeline run on fixtures (in-memory Postgres, mock LLM)
npm run offline       # pipeline on fixtures into .pglite-offline, prints the front page
npm run dev:offline   # same, then the website on http://localhost:3000 (admin password: admin)
npm run pipeline      # real run: needs .env (see .env.example)
npm run digest        # send due daily emails (dry-run logs without RESEND_API_KEY)
npm run submit -- https://x.com/... "title" [lang]
```

Without `DATABASE_URL` everything uses a local PGlite database (Postgres + pgvector in WASM), so no server is needed for development.

## Deploy

- **Database**: Supabase project; set `DATABASE_URL` (pooler URI). The pipeline applies `db/schema.sql` on every run.
- **Pipeline**: Railway service from this repo; `railway.json` sets `npm run pipeline` every 10 minutes. A second Railway cron service runs `npm run digest` at `0 * * * *`.
- **Website**: Vercel project from this repo with `DATABASE_URL`, `SITE_URL`, `ADMIN_PASSWORD`, `INGEST_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_OPERATOR`.

## Tuning after the first week of real data

- `thresholds` in `pipeline/brain.ts` (join / LLM-check similarity): look at wrongly merged or split events in the admin.
- Source weights in `config/sources.ts` and `HALF_LIFE_H` in `pipeline/rank.ts`.
- RSS URLs marked `verify` in `config/sources.ts`; failing sources show under Admin → Sources.

## Before launch

- Privacy policy (`app/[lang]/privacy`) is a draft: fill in the operator (`SITE_OPERATOR`) and have it reviewed; a German edition also needs an Impressum.
