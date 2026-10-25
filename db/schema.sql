-- AInstant schema. Runs on Supabase Postgres (pgvector enabled) and on PGlite for local dev.
-- Idempotent: safe to run on every deploy.

create extension if not exists vector;

-- Every place we pull from. weight feeds hotness; credibility is the default label for items from it.
create table if not exists sources (
  id              text primary key,
  kind            text not null,            -- rss | hn | reddit | huggingface | hf_papers | github_trending | openrouter | inbox
  name            text not null,
  url             text,
  weight          real not null default 1,
  credibility     text not null default 'media',  -- official | media | rumor
  ai_only         boolean not null default false, -- true: skip keyword prefilter
  lang            text not null default 'en',
  enabled         boolean not null default true,
  last_fetched_at timestamptz,
  last_error      text
);

-- One row per news story (the canonical URL), wherever we first saw it.
create table if not exists events (
  id             bigserial primary key,
  slug           text unique,
  title_en       text not null,
  why_en         text,                       -- "why it matters", one sentence
  category       text,
  item_type      text,
  tags           text[] not null default '{}',
  credibility    text,
  entities       text[] not null default '{}',
  centroid       vector(1024),
  hotness        real not null default 0,
  status         text not null default 'auto', -- auto | pending_review | approved | hidden
  has_controversy boolean not null default false,
  pinned         boolean not null default false,
  item_count     int not null default 0,
  source_count   int not null default 0,
  first_seen_at  timestamptz not null default now(),
  last_item_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  summarized_at  timestamptz
);
create index if not exists events_hot_idx on events (hotness desc);
create index if not exists events_recent_idx on events (last_item_at desc);

create table if not exists items (
  id            bigserial primary key,
  url_hash      text not null unique,
  url           text not null,
  source_id     text not null references sources(id),
  title         text not null,
  excerpt       text,                         -- internal only, <= 500 chars, never rendered
  lang          text,
  author        text,
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  engagement    int not null default 0,
  status        text not null default 'new',  -- new | rejected | labeled | classified (embedded) | clustered | error
  reject_reason text,
  category      text,
  item_type     text,
  tags          text[] not null default '{}',
  credibility   text,
  node_type     text,                         -- announcement | early_test | criticism | official_response | follow_up
  claim_type    text,                         -- fact | allegation | opinion
  summary_en    text,
  entities      text[] not null default '{}',
  embedding     vector(1024),
  event_id      bigint references events(id),
  attempts      int not null default 0
);
create index if not exists items_status_idx on items (status);
create index if not exists items_event_idx on items (event_id);

-- The same URL discussed elsewhere (HN thread, Reddit post, X post). Counts toward hotness.
create table if not exists mentions (
  id             bigserial primary key,
  url_hash       text not null references items(url_hash),
  source_id      text not null references sources(id),
  discussion_url text not null,
  engagement     int not null default 0,
  seen_at        timestamptz not null default now(),
  unique (url_hash, discussion_url)
);

-- Things pushed to us (Grok bot, manual submissions from the admin).
create table if not exists inbox (
  id           bigserial primary key,
  source_id    text not null default 'inbox',
  url          text not null,
  title        text,
  note         text,
  author       text,
  lang         text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- Translation cache: re-translate only when the English source text changes.
create table if not exists translations (
  entity_type text not null,     -- event | item
  entity_id   bigint not null,
  field       text not null,     -- title | why | summary
  lang        text not null,
  source_hash text not null,
  text        text not null,
  created_at  timestamptz not null default now(),
  primary key (entity_type, entity_id, field, lang)
);

create table if not exists price_snapshots (
  id               bigserial primary key,
  model_id         text not null,
  name             text,
  prompt_usd_per_m     numeric,
  completion_usd_per_m numeric,
  context_length   int,
  captured_at      timestamptz not null default now()
);
create index if not exists price_model_idx on price_snapshots (model_id, captured_at desc);

-- Every human edit, shown publicly when public = true.
create table if not exists corrections (
  id         bigserial primary key,
  event_id   bigint references events(id),
  field      text not null,
  old_value  text,
  new_value  text,
  reason     text,
  editor     text,
  public     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists subscribers (
  id              bigserial primary key,
  email           text not null unique,
  lang            text not null default 'en',
  timezone        text not null default 'UTC',
  token           text not null,
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  last_sent_on    date,
  created_at      timestamptz not null default now()
);

create table if not exists runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  stats       jsonb
);
