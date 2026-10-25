import type { Db } from "../lib/db.ts";
import type { RawItem, SourceConfig } from "../types.ts";
import { fetchSource } from "../sources/index.ts";
import { urlHash } from "../lib/url.ts";
import { log, mapLimit } from "../lib/util.ts";
import { AI_KEYWORDS } from "../../config/keywords.ts";

export async function syncSources(db: Db, sources: SourceConfig[]): Promise<void> {
  for (const s of sources) {
    await db.query(
      `insert into sources (id, kind, name, url, weight, credibility, ai_only, lang, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set kind = excluded.kind, name = excluded.name, url = excluded.url, weight = excluded.weight,
         credibility = excluded.credibility, ai_only = excluded.ai_only, lang = excluded.lang, enabled = excluded.enabled`,
      [s.id, s.kind, s.name, s.url ?? null, s.weight, s.credibility, s.aiOnly, s.lang ?? "en", s.enabled ?? true],
    );
  }
}

export interface IngestStats {
  fetched: number;
  prefiltered: number;
  inserted: number;
  mentions: number;
  failedSources: string[];
}

/** Fetch every enabled source, drop obvious non-AI items, store new URLs as items and repeats as mentions. */
export async function ingest(db: Db, sources: SourceConfig[]): Promise<IngestStats> {
  const stats: IngestStats = { fetched: 0, prefiltered: 0, inserted: 0, mentions: 0, failedSources: [] };
  const enabled = sources.filter((s) => s.enabled !== false);

  const batches = await mapLimit(enabled, 6, async (src) => {
    try {
      const items = await fetchSource(src, db);
      await db.query(`update sources set last_fetched_at = now(), last_error = null where id = $1`, [src.id]);
      return { src, items };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`source ${src.id} failed: ${msg}`);
      stats.failedSources.push(src.id);
      await db.query(`update sources set last_error = $2 where id = $1`, [src.id, msg.slice(0, 500)]);
      return { src, items: [] as RawItem[] };
    }
  });

  for (const { src, items } of batches) {
    for (const raw of items) {
      stats.fetched++;
      if (!src.aiOnly && !AI_KEYWORDS.test(`${raw.title} ${raw.excerpt ?? ""}`)) {
        stats.prefiltered++;
        continue;
      }
      if (await store(db, raw)) stats.inserted++;
      else stats.mentions++;
    }
  }
  return stats;
}

/** Returns true for a new item, false when the URL was already known (recorded as a mention). */
async function store(db: Db, raw: RawItem): Promise<boolean> {
  const hash = urlHash(raw.dedupeKey ?? raw.url);
  const inserted = await db.query(
    `insert into items (url_hash, url, source_id, title, excerpt, lang, author, published_at, engagement)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (url_hash) do nothing returning id`,
    [hash, raw.url, raw.sourceId, raw.title, raw.excerpt ?? null, raw.lang ?? null, raw.author ?? null,
     raw.publishedAt && !isNaN(+raw.publishedAt) ? raw.publishedAt : null, raw.engagement ?? 0],
  );
  if (inserted.length) return true;

  const [existing] = await db.query<{ source_id: string }>(`select source_id from items where url_hash = $1`, [hash]);
  if (existing.source_id === raw.sourceId) {
    await db.query(`update items set engagement = greatest(engagement, $2) where url_hash = $1`, [hash, raw.engagement ?? 0]);
  } else {
    await db.query(
      `insert into mentions (url_hash, source_id, discussion_url, engagement) values ($1, $2, $3, $4)
       on conflict (url_hash, discussion_url) do update set engagement = greatest(mentions.engagement, excluded.engagement)`,
      [hash, raw.sourceId, raw.discussionUrl ?? raw.url, raw.engagement ?? 0],
    );
  }
  return false;
}
