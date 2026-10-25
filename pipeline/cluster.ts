import type { Db } from "../lib/db.ts";
import type { Brain } from "./brain.ts";

export type Decision = "join" | "check" | "new";

/**
 * Very similar: same story. Somewhat similar and sharing a name (company, model): ask the LLM.
 * Otherwise: a new story. Names guard against "two different OpenAI launches on the same day".
 */
export function decide(sim: number, sharesEntity: boolean, t: Brain["thresholds"]): Decision {
  if (sim >= t.join) return "join";
  if (sim >= t.check && sharesEntity) return "check";
  return "new";
}

/** Same name, or one is a variant of the other ("Orca-S2S" and "Orca-S2S-7B"). */
export function sharesEntity(a: string[], b: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  const bs = b.map(norm);
  return a.map(norm).some((x) => bs.some((y) => x === y || x.startsWith(`${y}-`) || y.startsWith(`${x}-`)));
}

interface ItemRow {
  id: number;
  embedding: string;
  summary_en: string;
  entities: string[];
  category: string;
  item_type: string;
  tags: string[];
  credibility: string;
  at: Date;
}

export interface ClusterStats {
  joined: number;
  created: number;
  llmChecks: number;
}

/** Attach each embedded item to an active event (last 7 days) or start a new one. Oldest first, so the first report founds the event. */
export async function cluster(db: Db, brain: Brain): Promise<ClusterStats> {
  const items = await db.query<ItemRow>(
    `select id, embedding::text as embedding, summary_en, entities, category, item_type, tags, credibility,
            coalesce(published_at, fetched_at) as at
       from items where status = 'classified' and embedding is not null
      order by coalesce(published_at, fetched_at)`,
  );
  const stats: ClusterStats = { joined: 0, created: 0, llmChecks: 0 };

  for (const it of items) {
    const [best] = await db.query<{ id: number; title_en: string; entities: string[]; sim: number }>(
      `select id, title_en, entities, 1 - (centroid <=> $1::vector) as sim
         from events where status <> 'hidden' and last_item_at > $2::timestamptz - interval '7 days'
        order by centroid <=> $1::vector limit 1`,
      [it.embedding, it.at],
    );
    let target: number | null = null;
    if (best) {
      const d = decide(Number(best.sim), sharesEntity(best.entities, it.entities), brain.thresholds);
      if (d === "join") target = best.id;
      if (d === "check") {
        stats.llmChecks++;
        if (await brain.sameEvent({ title: best.title_en, entities: best.entities }, { summary: it.summary_en, entities: it.entities })) {
          target = best.id;
        }
      }
    }

    if (target) {
      await db.query(`update items set event_id = $2, status = 'clustered' where id = $1`, [it.id, target]);
      await db.query(
        `update events set
           entities = (select array(select distinct unnest(entities || $2::text[]))),
           last_item_at = greatest(last_item_at, $3::timestamptz),
           item_count = item_count + 1,
           centroid = (select avg(embedding) from items where event_id = $1),
           updated_at = now()
         where id = $1`,
        [target, it.entities, it.at],
      );
      stats.joined++;
    } else {
      const [ev] = await db.query<{ id: number }>(
        `insert into events (title_en, category, item_type, tags, credibility, entities, centroid, item_count, first_seen_at, last_item_at)
         values ($1, $2, $3, $4, $5, $6, $7::vector, 1, $8, $8) returning id`,
        [it.summary_en, it.category, it.item_type, it.tags, it.credibility, it.entities, it.embedding, it.at],
      );
      await db.query(`update items set event_id = $2, status = 'clustered' where id = $1`, [it.id, ev.id]);
      stats.created++;
    }
  }
  return stats;
}
