// Read-side queries shared by the website, RSS and the daily email.
import { getDb } from "./db.ts";
import type { Lang } from "../config/site.ts";
import { normName } from "../pipeline/models.ts";

/** Events readers may see. pending_review (disputed, not yet checked by a human) and hidden stay off the site. */
export const VISIBLE = `status in ('auto', 'approved')`;

const tr = (field: string, alias: string, entity = "event", idCol = "e.id") =>
  `left join translations ${alias} on ${alias}.entity_type = '${entity}' and ${alias}.entity_id = ${idCol} and ${alias}.field = '${field}' and ${alias}.lang = $1`;

/** Pushed items (Grok, manual) are labelled by where they come from, not by "inbox". */
const SOURCE_LABEL = `case when s.kind = 'inbox' then case split_part(split_part(i.url, '://', 2), '/', 1)
    when 'x.com' then 'X' when 'twitter.com' then 'X' when 'weibo.com' then '微博 Weibo' when 'm.weibo.cn' then '微博 Weibo'
    when 'okjike.com' then '即刻 Jike' when 'www.zhihu.com' then '知乎 Zhihu' when 'zhuanlan.zhihu.com' then '知乎 Zhihu'
    when 'www.xiaohongshu.com' then '小红书 Xiaohongshu' else regexp_replace(split_part(split_part(i.url, '://', 2), '/', 1), '^www\\.', '') end
  else s.name end`;

export interface EventCard {
  id: number;
  slug: string;
  title: string;
  why: string | null;
  category: string | null;
  item_type: string | null;
  tags: string[];
  credibility: string | null;
  hotness: number;
  source_count: number;
  item_count: number;
  last_item_at: Date;
  has_controversy: boolean;
}

export interface Filters {
  category?: string;
  type?: string;
  tag?: string;
  sinceHours?: number;
  limit?: number;
}

export async function getHeadlines(lang: Lang, f: Filters = {}): Promise<EventCard[]> {
  const db = await getDb();
  return db.query<EventCard>(
    `select e.id, e.slug, coalesce(tt.text, e.title_en) as title, coalesce(tw.text, e.why_en) as why,
            e.category, e.item_type, e.tags, e.credibility, e.hotness, e.source_count, e.item_count, e.last_item_at, e.has_controversy
       from events e ${tr("title", "tt")} ${tr("why", "tw")}
      where e.${VISIBLE} and e.slug is not null
        and ($2::text is null or e.category = $2) and ($3::text is null or e.item_type = $3) and ($4::text is null or $4 = any(e.tags))
        and e.last_item_at > now() - make_interval(hours => $5)
      order by e.pinned desc, e.hotness desc, e.last_item_at desc
      limit $6`,
    [lang, f.category ?? null, f.type ?? null, f.tag ?? null, f.sinceHours ?? 72, f.limit ?? 40],
  );
}

export interface TimelineItem {
  id: number;
  url: string;
  title: string;
  summary: string;
  source_name: string;
  source_kind: string;
  node_type: string;
  claim_type: string;
  credibility: string;
  at: Date;
  author: string | null;
}

export interface EventDetail extends EventCard {
  title_en: string;
  first_seen_at: Date;
  status: string;
  items: TimelineItem[];
  discussions: { source_name: string; discussion_url: string; engagement: number }[];
  corrections: { field: string; old_value: string | null; new_value: string | null; reason: string | null; created_at: Date }[];
}

export async function getEvent(lang: Lang, slug: string, includeHidden = false): Promise<EventDetail | null> {
  const db = await getDb();
  const [ev] = await db.query<EventDetail>(
    `select e.id, e.slug, coalesce(tt.text, e.title_en) as title, e.title_en, coalesce(tw.text, e.why_en) as why,
            e.category, e.item_type, e.tags, e.credibility, e.hotness, e.source_count, e.item_count, e.last_item_at,
            e.has_controversy, e.first_seen_at, e.status
       from events e ${tr("title", "tt")} ${tr("why", "tw")}
      where e.slug = $2 ${includeHidden ? "" : `and e.${VISIBLE}`}`,
    [lang, slug],
  );
  if (!ev) return null;
  ev.items = await db.query<TimelineItem>(
    `select i.id, i.url, i.title, coalesce(ts.text, i.summary_en) as summary, ${SOURCE_LABEL} as source_name, s.kind as source_kind,
            i.node_type, i.claim_type, i.credibility, coalesce(i.published_at, i.fetched_at) as at, i.author
       from items i join sources s on s.id = i.source_id ${tr("summary", "ts", "item", "i.id")}
      where i.event_id = $2 order by coalesce(i.published_at, i.fetched_at)`,
    [lang, ev.id],
  );
  ev.discussions = await db.query(
    `select s.name as source_name, m.discussion_url, m.engagement
       from mentions m join items i on i.url_hash = m.url_hash join sources s on s.id = m.source_id
      where i.event_id = $1 order by m.engagement desc`,
    [ev.id],
  );
  ev.corrections = await db.query(
    `select field, old_value, new_value, reason, created_at from corrections where event_id = $1 and public order by created_at`,
    [ev.id],
  );
  return ev;
}

export interface PriceRow {
  model_id: string;
  name: string;
  prompt: number;
  completion: number;
  context_length: number | null;
  captured_at: Date;
  prev_prompt: number | null;
  prev_completion: number | null;
}

/** Latest price per model, with the previous price when it changed. */
export async function getPrices(): Promise<PriceRow[]> {
  const db = await getDb();
  return db.query<PriceRow>(
    `with ranked as (
       select *, row_number() over (partition by model_id order by captured_at desc) as rn from price_snapshots
     )
     select a.model_id, a.name, a.prompt_usd_per_m::float8 as prompt, a.completion_usd_per_m::float8 as completion,
            a.context_length, a.captured_at, b.prompt_usd_per_m::float8 as prev_prompt, b.completion_usd_per_m::float8 as prev_completion
       from ranked a left join ranked b on b.model_id = a.model_id and b.rn = 2
      where a.rn = 1
      order by (b.model_id is not null) desc, a.captured_at desc, a.name`,
  );
}

export interface Sponsor {
  id: number;
  title: string;
  body: string | null;
  url: string;
}

export async function getSponsor(lang: Lang, placement: "home" | "newsletter"): Promise<Sponsor | null> {
  const db = await getDb();
  const [s] = await db.query<Sponsor>(
    `select id, title, body, url from sponsors where lang = $1 and placement = $2 and now() between starts_at and ends_at
      order by starts_at desc limit 1`,
    [lang, placement],
  );
  return s ?? null;
}

// ---------- Homepage topic cards ----------

export interface TopicNews {
  id: number;
  slug: string;
  title: string;
  item_type: string | null;
  has_controversy: boolean;
  source_count: number;
  first_seen_at: Date;
  last_item_at: Date;
}

/** Latest stories in one section, newest activity first. */
export async function getTopicNews(lang: Lang, category: string, limit = 6, days = 7): Promise<TopicNews[]> {
  const db = await getDb();
  return db.query<TopicNews>(
    `select e.id, e.slug, coalesce(tt.text, e.title_en) as title, e.item_type, e.has_controversy, e.source_count,
            e.first_seen_at, e.last_item_at
       from events e ${tr("title", "tt")}
      where e.${VISIBLE} and e.slug is not null and e.category = $2 and e.last_item_at > now() - make_interval(days => $3)
      order by e.pinned desc, e.last_item_at desc
      limit $4`,
    [lang, category, days, limit],
  );
}

export interface ModelPoint {
  id: number;
  name: string;
  creator: string | null;
  modality: string;
  released_on: string | null;
  score: number | null;
  agentic_score: number | null;
  /** A story about this model, when one names it. */
  slug: string | null;
}

export async function getModels(): Promise<ModelPoint[]> {
  const db = await getDb();
  const rows = await db.query<ModelPoint & { released_on: Date | string | null }>(
    `select id, name, creator, modality, released_on, score, agentic_score, null as slug from models where score is not null`,
  );
  const stories = await db.query<{ slug: string; entities: string[] }>(
    `select slug, entities from events where ${VISIBLE} and slug is not null and category = 'models' order by first_seen_at desc limit 300`,
  );
  const byName = new Map<string, string>();
  for (const e of stories) for (const x of e.entities) if (!byName.has(normName(x))) byName.set(normName(x), e.slug);
  return rows.map((r) => ({
    ...r,
    released_on: r.released_on ? new Date(r.released_on).toISOString().slice(0, 10) : null,
    slug: byName.get(normName(r.name)) ?? null,
  }));
}

/** New stories per section per day, oldest day first. */
export async function getDailyCounts(days = 14): Promise<Record<string, number[]>> {
  const db = await getDb();
  const rows = await db.query<{ category: string; d: number; n: number }>(
    `select category, (current_date - first_seen_at::date)::int as d, count(*)::int as n
       from events where ${VISIBLE} and category is not null and first_seen_at > current_date - $1::int
      group by 1, 2`,
    [days - 1],
  );
  const out: Record<string, number[]> = {};
  for (const r of rows) (out[r.category] ??= new Array(days).fill(0))[days - 1 - r.d] = r.n;
  return out;
}

export interface RisingTag {
  tag: string;
  now: number;
  before: number;
}

/** Tags on this week's stories compared with the week before. */
export async function getRisingTags(limit = 8): Promise<RisingTag[]> {
  const db = await getDb();
  return db.query<RisingTag>(
    `select tag, count(*) filter (where first_seen_at > now() - interval '7 days')::int as now,
            count(*) filter (where first_seen_at <= now() - interval '7 days')::int as before
       from events, unnest(tags) as tag
      where ${VISIBLE} and first_seen_at > now() - interval '14 days'
      group by tag
     having count(*) filter (where first_seen_at > now() - interval '7 days') >= 2
      order by (count(*) filter (where first_seen_at > now() - interval '7 days') - count(*) filter (where first_seen_at <= now() - interval '7 days')) desc, tag
      limit $1`,
    [limit],
  );
}

export interface Incident {
  slug: string;
  title: string;
  first_seen_at: Date;
  hotness: number;
  has_controversy: boolean;
}

export async function getIncidents(lang: Lang, days = 30): Promise<Incident[]> {
  const db = await getDb();
  return db.query<Incident>(
    `select e.slug, coalesce(tt.text, e.title_en) as title, e.first_seen_at, e.hotness, e.has_controversy
       from events e ${tr("title", "tt")}
      where e.${VISIBLE} and e.slug is not null and (e.category = 'safety_incident' or e.item_type = 'incident')
        and e.first_seen_at > now() - make_interval(days => $2)
      order by e.first_seen_at`,
    [lang, days],
  );
}

// ---------- Weekly ----------

/** Visible events by id, in the given order (a story hidden later drops out). */
export async function getEventsById(lang: Lang, ids: (number | string)[]): Promise<EventCard[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.query<EventCard>(
    `select e.id, e.slug, coalesce(tt.text, e.title_en) as title, coalesce(tw.text, e.why_en) as why,
            e.category, e.item_type, e.tags, e.credibility, e.hotness, e.source_count, e.item_count, e.last_item_at, e.has_controversy
       from events e ${tr("title", "tt")} ${tr("why", "tw")}
      where e.${VISIBLE} and e.slug is not null and e.id = any($2::bigint[])`,
    [lang, ids.map(Number)],
  );
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  return ids.map((id) => byId.get(Number(id))).filter((e): e is EventCard => !!e);
}

export interface WeeklyIssue {
  id: number;
  week: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  intro: string | null;
  approved_at: Date | null;
  top: EventCard[];
  more: EventCard[];
  stats: import("../pipeline/weekly.ts").WeeklyStats;
  prev: string | null;
  next: string | null;
}

/** One issue. Drafts only when includeDraft (admin preview). */
export async function getWeekly(lang: Lang, week: string, includeDraft = false): Promise<WeeklyIssue | null> {
  const db = await getDb();
  const [w] = await db.query<Omit<WeeklyIssue, "top" | "more" | "prev" | "next"> & { top_ids: number[]; more_ids: number[] }>(
    `select w.id, w.week, w.starts_at, w.ends_at, w.status, coalesce(ti.text, w.intro_en) as intro, w.approved_at, w.top_ids, w.more_ids, w.stats
       from weeklies w ${tr("intro", "ti", "weekly", "w.id")}
      where w.week = $2 and ($3 or w.status = 'approved')`,
    [lang, week, includeDraft],
  );
  if (!w) return null;
  const [top, more, [prev], [next]] = await Promise.all([
    getEventsById(lang, w.top_ids),
    getEventsById(lang, w.more_ids),
    db.query<{ week: string }>(`select week from weeklies where status = 'approved' and week < $1 order by week desc limit 1`, [week]),
    db.query<{ week: string }>(`select week from weeklies where status = 'approved' and week > $1 order by week limit 1`, [week]),
  ]);
  const stats = typeof w.stats === "string" ? JSON.parse(w.stats) : w.stats;
  return { ...w, stats, top, more, prev: prev?.week ?? null, next: next?.week ?? null };
}

export interface WeeklyListItem {
  week: string;
  starts_at: Date;
  intro: string | null;
  status: string;
}

export async function listWeeklies(lang: Lang, includeDraft = false, limit = 60): Promise<WeeklyListItem[]> {
  const db = await getDb();
  return db.query<WeeklyListItem>(
    `select w.week, w.starts_at, coalesce(ti.text, w.intro_en) as intro, w.status
       from weeklies w ${tr("intro", "ti", "weekly", "w.id")}
      where $2 or w.status = 'approved'
      order by w.week desc limit $3`,
    [lang, includeDraft, limit],
  );
}
