import type { RawItem, SourceConfig } from "../../lib/types.ts";
import type { Db } from "../../lib/db.ts";
import { sha } from "../../lib/url.ts";
import { fetchText } from "../../lib/util.ts";

/** Visible text of an HTML page, one block per line. Scripts, styles and markup are dropped. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|td|th|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
    .join("\n");
}

// Lines that change on every load and mean nothing: copyright years, timestamps, counters.
const NOISE = /^(©|copyright|\d+\s*(min|minutes?|hours?|days?)\s+ago|last updated|updated:?\s|\d{1,2}:\d{2})/i;

/** Lines present now that were not there before, ignoring noise. */
export function addedLines(before: string, after: string): string[] {
  const old = new Set(before.split("\n"));
  return after.split("\n").filter((l) => !old.has(l) && !NOISE.test(l) && /[a-z一-鿿]/i.test(l));
}

/**
 * Watch a page that has no feed (pricing, changelog, news index). First fetch only records it.
 * Afterwards each change becomes one item whose excerpt holds the new lines; the LLM decides if it is news.
 */
export async function fetchPageWatch(cfg: SourceConfig, db: Db, html?: string): Promise<RawItem[]> {
  const text = pageText(html ?? (await fetchText(cfg.url!))).slice(0, 100_000);
  const hash = sha(text);
  const [prev] = await db.query<{ hash: string; text: string }>(`select hash, text from page_snapshots where source_id = $1`, [cfg.id]);
  if (prev?.hash === hash) return [];
  await db.query(
    `insert into page_snapshots (source_id, hash, text) values ($1, $2, $3)
     on conflict (source_id) do update set hash = excluded.hash, text = excluded.text, captured_at = now()`,
    [cfg.id, hash, text],
  );
  if (!prev) return [];
  const added = addedLines(prev.text, text);
  if (added.length === 0) return [];
  return [
    {
      sourceId: cfg.id,
      url: cfg.url!,
      dedupeKey: `${cfg.url}#${hash}`,
      title: `${cfg.name} changed: ${added[0].slice(0, 160)}`,
      excerpt: added.join(" | ").slice(0, 500),
      publishedAt: new Date(),
    },
  ];
}
