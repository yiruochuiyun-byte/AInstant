// Read-side queries shared by the website, RSS and the daily email.
import { getDb } from "./db.ts";
import type { Lang } from "../config/site.ts";

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
