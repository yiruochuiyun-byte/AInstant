import type { Db } from "../lib/db.ts";
import { vec } from "../lib/db.ts";
import type { Brain } from "./brain.ts";
import { log, mapLimit } from "../lib/util.ts";

interface Row {
  id: number;
  title: string;
  excerpt: string | null;
  url: string;
  lang: string | null;
  source_name: string;
  credibility: string;
}

export interface ClassifyStats {
  classified: number;
  rejected: number;
  errors: number;
}

/** Label new items with the LLM. Kept items become 'labeled' and wait for embedding. */
export async function classifyNew(db: Db, brain: Brain, limit = 300): Promise<ClassifyStats> {
  const rows = await db.query<Row>(
    `select i.id, i.title, i.excerpt, i.url, i.lang, s.name as source_name, s.credibility
       from items i join sources s on s.id = i.source_id
      where i.status = 'new' and i.attempts < 3
      order by i.fetched_at limit $1`,
    [limit],
  );
  const stats: ClassifyStats = { classified: 0, rejected: 0, errors: 0 };

  const results = await mapLimit(rows, 8, async (r) => {
    try {
      const c = await brain.classify({ source: r.source_name, credibility: r.credibility, title: r.title, excerpt: r.excerpt, url: r.url, lang: r.lang });
      return { row: r, c };
    } catch (err) {
      stats.errors++;
      log(`classify ${r.id} failed: ${err instanceof Error ? err.message : err}`);
      await db.query(`update items set attempts = attempts + 1, status = case when attempts >= 2 then 'error' else status end where id = $1`, [r.id]);
      return null;
    }
  });

  for (const res of results) {
    if (!res) continue;
    const { row, c } = res;
    const relevant = c.relevant && c.reject_reason === "none";
    await db.query(
      `update items set status = $2, reject_reason = $3, category = $4, item_type = $5, tags = $6, credibility = $7,
              node_type = $8, claim_type = $9, summary_en = $10, entities = $11
        where id = $1`,
      [row.id, relevant ? "labeled" : "rejected", relevant ? null : c.reject_reason, c.category, c.item_type,
       c.tags.slice(0, 4), row.credibility, c.node_type, c.claim_type, c.summary_en, c.entities.slice(0, 10)],
    );
    if (relevant) stats.classified++;
    else stats.rejected++;
  }

  return stats;
}

/** Embed labeled items (including leftovers from a run where the embedding call failed). */
export async function embedLabeled(db: Db, brain: Brain): Promise<number> {
  const rows = await db.query<{ id: number; title: string; summary_en: string; entities: string[] }>(
    `select id, title, summary_en, entities from items where status = 'labeled' order by id limit 1000`,
  );
  // One call per 64 items. The text mixes the rewritten summary, names and original title.
  for (let i = 0; i < rows.length; i += 64) {
    const chunk = rows.slice(i, i + 64);
    const vectors = await brain.embed(chunk.map((r) => `${r.summary_en}\n${r.entities.join(", ")}\n${r.title}`));
    for (let j = 0; j < chunk.length; j++) {
      await db.query(`update items set embedding = $2::vector, status = 'classified' where id = $1`, [chunk[j].id, vec(vectors[j])]);
    }
  }
  return rows.length;
}
