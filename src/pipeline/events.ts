import type { Db } from "../lib/db.ts";
import type { Brain } from "./brain.ts";
import type { TimelineEntry } from "../lib/llm.ts";
import { log } from "../lib/util.ts";

const CRED_RANK: Record<string, number> = { official: 3, media: 2, rumor: 1 };

export function slugify(title: string, id: number): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60)
    .replace(/-$/, "");
  return `${base || "event"}-${id}`;
}

/**
 * Rewrite headline, "why it matters" and labels for events that changed since they were last summarized.
 * Disputed events go to the review queue and stay off the front page until approved.
 */
export async function refreshEvents(db: Db, brain: Brain): Promise<number> {
  const events = await db.query<{ id: number; slug: string | null; status: string; title_en: string }>(
    `select id, slug, status, title_en from events where summarized_at is null or summarized_at < updated_at`,
  );
  for (const ev of events) {
    const items = await db.query<TimelineEntry & { source_id: string }>(
      `select to_char(coalesce(i.published_at, i.fetched_at), 'YYYY-MM-DD"T"HH24:MI"Z"') as at, s.name as source, i.source_id,
              i.credibility, i.node_type, i.claim_type, i.summary_en as summary
         from items i join sources s on s.id = i.source_id
        where i.event_id = $1 order by coalesce(i.published_at, i.fetched_at)`,
      [ev.id],
    );
    if (items.length === 0) continue;

    const controversy = items.some((i) => i.node_type === "criticism" || i.claim_type === "allegation");
    const credibility = items.reduce((best, i) => ((CRED_RANK[i.credibility] ?? 0) > (CRED_RANK[best] ?? 0) ? i.credibility : best), "rumor");
    const sourceCount = new Set(items.map((i) => i.source_id)).size;

    let summary = null;
    if (items.length > 1) {
      try {
        summary = await brain.summarizeEvent(items.map(({ source_id: _, ...t }) => t));
      } catch (err) {
        log(`summarize event ${ev.id} failed: ${err instanceof Error ? err.message : err}`);
        continue; // retried next run
      }
    }
    const title = summary?.title_en ?? ev.title_en;
    await db.query(
      `update events set
         title_en = $2, why_en = coalesce($3, why_en),
         category = coalesce($4, category), item_type = coalesce($5, item_type), tags = coalesce($6, tags),
         credibility = $7, has_controversy = $8, source_count = $9,
         status = case when $8 and status = 'auto' then 'pending_review' else status end,
         slug = coalesce(slug, $10),
         summarized_at = now()
       where id = $1`,
      [ev.id, title, summary?.why_en ?? null, summary?.category ?? null, summary?.item_type ?? null, summary?.tags ?? null,
       credibility, controversy, sourceCount, slugify(title, ev.id)],
    );
  }
  return events.length;
}
