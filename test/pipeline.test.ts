// End to end on fixtures: in-memory Postgres (PGlite + pgvector), mock LLM and embeddings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { connect, migrate } from "../lib/db.ts";
import { mockBrain } from "../pipeline/brain.ts";
import { runOnce } from "../pipeline/run.ts";
import { SOURCES } from "../config/sources.ts";

process.env.AINSTANT_OFFLINE = "1";
const NOW = new Date("2026-10-25T06:00:00Z");

test("pipeline turns fixtures into ranked events", async () => {
  const db = await connect({ memory: true });
  await migrate(db);
  // OpenRouter history: one unchanged model, one about to get cheaper. The third model in the fixture is new.
  await db.query(`insert into price_snapshots (model_id, name, prompt_usd_per_m, completion_usd_per_m) values
    ('acme/stable-chat', 'Acme: Stable Chat', 1, 2), ('lumenlabs/orca-chat', 'Lumen Labs: Orca Chat', 1, 3)`);

  const stats = await runOnce(db, mockBrain, SOURCES, NOW);

  // Non-AI HN stories and the static site generator never reach the LLM.
  assert.equal(stats.ingested.prefiltered, 3);
  // The Reddit link to the Lumen blog is the same URL as the HN story, so it is a mention, not a new item.
  const mentions = await db.query<{ source_id: string }>(`select source_id from mentions`);
  assert.deepEqual(mentions.map((m) => m.source_id), ["r-localllama"]);
  // Funding news is rejected.
  const [funding] = await db.query<{ status: string; reject_reason: string }>(`select status, reject_reason from items where url like '%series-b%'`);
  assert.deepEqual(funding, { status: "rejected", reject_reason: "funding" });

  const top = await db.query<{ id: number; title_en: string; status: string; item_count: number; has_controversy: boolean; hotness: number; slug: string }>(
    `select id, title_en, status, item_count, has_controversy, hotness, slug from events order by hotness desc`,
  );
  const orca = top[0];
  assert.match(orca.title_en, /Orca-S2S/);
  // Announcement, HF model, HN, Weibo, TechCrunch, Reddit test, criticism, response: one story.
  assert.ok(orca.item_count >= 7, `orca has ${orca.item_count} items`);
  assert.equal(orca.has_controversy, true);
  assert.equal(orca.status, "pending_review");
  assert.match(orca.slug, new RegExp(`-${orca.id}$`));

  const kestrel = top.find((e) => /Kestrel/i.test(e.title_en) && e.id !== orca.id);
  assert.ok(kestrel, "Kestrel-Coder is its own event");
  const kestrelItems = await db.query(`select 1 from items where event_id = $1`, [kestrel.id]);
  assert.ok(kestrelItems.length >= 2, "Reddit post and GitHub repo grouped");

  // OpenRouter diff produced a price cut and a new-model item.
  const or = await db.query<{ title: string }>(`select title from items where source_id = 'openrouter' order by title`);
  assert.equal(or.length, 2);
  assert.ok(or.some((r) => /price cut/.test(r.title)));
  assert.ok(or.some((r) => /now on OpenRouter/.test(r.title)));

  // Visible events are translated; disputed ones wait for review first.
  const zh = await db.query<{ entity_id: number }>(`select entity_id from translations where entity_type = 'event' and field = 'title' and lang = 'zh'`);
  assert.ok(zh.some((r) => r.entity_id === kestrel.id));
  assert.ok(!zh.some((r) => r.entity_id === orca.id));

  // A second run with the same data adds nothing and translates nothing again.
  const again = await runOnce(db, mockBrain, SOURCES, NOW);
  assert.equal(again.ingested.inserted, 0);
  assert.equal(again.classified.classified, 0);
  assert.equal(again.translated, 0);
  await db.close();
});
