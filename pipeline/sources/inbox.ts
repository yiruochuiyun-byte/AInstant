import type { RawItem, SourceConfig } from "../../lib/types.ts";
import type { Db } from "../../lib/db.ts";

/**
 * Items pushed to us: the Grok bot watching X, and manual submissions from the admin.
 * The website's POST /api/ingest (week 2) and scripts/submit.ts both write to the inbox table.
 */
export async function fetchInbox(cfg: SourceConfig, db: Db): Promise<RawItem[]> {
  const rows = await db.query<{ id: number; url: string; title: string | null; note: string | null; author: string | null; lang: string | null; received_at: Date }>(
    `update inbox set processed_at = now() where processed_at is null
     returning id, url, title, note, author, lang, received_at`,
  );
  return rows.map((r) => ({
    sourceId: cfg.id,
    url: r.url,
    title: r.title ?? r.note ?? r.url,
    excerpt: r.note ?? undefined,
    author: r.author ?? undefined,
    lang: r.lang ?? undefined,
    publishedAt: new Date(r.received_at),
    discussionUrl: r.url,
  }));
}
