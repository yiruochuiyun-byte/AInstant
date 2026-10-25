// Print the current front page: events by hotness with their timelines.
import { connect } from "../src/lib/db.ts";

const db = await connect();
const events = await db.query<{ id: number; title_en: string; why_en: string | null; hotness: number; status: string; credibility: string; item_count: number; source_count: number }>(
  `select id, title_en, why_en, hotness, status, credibility, item_count, source_count from events
    where status <> 'hidden' order by hotness desc limit $1`,
  [Number(process.argv[2] ?? 10)],
);
for (const e of events) {
  console.log(`\n[${e.hotness.toFixed(2)}] ${e.title_en}  (${e.status}, ${e.credibility}, ${e.item_count} items / ${e.source_count} sources)`);
  if (e.why_en) console.log(`  why: ${e.why_en}`);
  const items = await db.query<{ at: string; source_id: string; node_type: string; claim_type: string; summary_en: string; url: string }>(
    `select to_char(coalesce(published_at, fetched_at), 'MM-DD HH24:MI') as at, source_id, node_type, claim_type, summary_en, url
       from items where event_id = $1 order by coalesce(published_at, fetched_at)`,
    [e.id],
  );
  for (const i of items) console.log(`  ${i.at}  ${i.node_type.padEnd(17)} ${i.claim_type.padEnd(10)} ${i.source_id.padEnd(14)} ${i.summary_en}`);
}
await db.close();
