import { test } from "node:test";
import assert from "node:assert/strict";
import { connect, migrate } from "../lib/db.ts";
import { datesFromNews, mergeVariants, normName, syncModels } from "../pipeline/models.ts";
import { panels } from "../lib/modelPanels.ts";

process.env.AINSTANT_OFFLINE = "1";

test("effort variants collapse into one model with the best score", () => {
  assert.equal(normName("Orca 5 (high)"), normName("orca-5 (low)"));
  const rows = mergeVariants("language", [
    { name: "Orca 5 (high)", release_date: "2026-10-22", evaluations: { artificial_analysis_intelligence_index: 71, artificial_analysis_agentic_index: 60 } },
    { name: "Orca 5 (low)", release_date: "2026-10-22", evaluations: { artificial_analysis_intelligence_index: 64, artificial_analysis_agentic_index: 66 } },
    { name: "Unscored", evaluations: { artificial_analysis_intelligence_index: null } },
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.score, r.agentic]), [["Orca 5", 71, 66]]);
});

test("leaderboard sync: dated LLMs, media models dated from our launch stories, never 'today' on re-sync", async () => {
  const db = await connect({ memory: true });
  await migrate(db);
  const t0 = new Date("2026-10-25T06:00:00Z");
  const first = await syncModels(db, t0);
  assert.ok(first && first.language > 40 && first.video > 10);
  // Within 12 hours nothing is fetched again.
  assert.equal(await syncModels(db, new Date(t0.getTime() + 3600_000)), null);

  const [{ undated }] = await db.query<{ undated: number }>(`select count(*)::int as undated from models where modality = 'video' and released_on is null`);
  assert.ok(undated > 0, "free media boards carry no dates, so the first import leaves them undated");

  const [video] = await db.query<{ name: string }>(`select name from models where modality = 'video' order by name limit 1`);
  await db.query(
    `insert into events (title_en, category, item_type, entities, first_seen_at) values ('launch', 'models', 'launch', $1, '2026-03-02T10:00:00Z')`,
    [[video.name]],
  );
  await syncModels(db, new Date(t0.getTime() + 13 * 3600_000));
  const [row] = await db.query<{ released_on: Date }>(`select released_on from models where name = $1 and modality = 'video'`, [video.name]);
  assert.equal(new Date(row.released_on).toISOString().slice(0, 10), "2026-03-02");
  const [{ today }] = await db.query<{ today: number }>(`select count(*)::int as today from models where released_on = '2026-10-25'`);
  assert.equal(today, 0);
  assert.equal(await datesFromNews(db), 0);
  await db.close();
});

test("dot plot panels: agents reuse language models, undated ones are counted not plotted", () => {
  const m = (id: number, modality: string, released_on: string | null, score: number, agentic_score: number | null = null) =>
    ({ id, name: `M${id}`, creator: null, modality, released_on, score, agentic_score, slug: null });
  const ps = panels([m(1, "language", "2026-10-01", 50, 40), m(2, "language", "2026-01-01", 30), m(3, "video", null, 1100), m(4, "video", "2026-05-01", 1000)]);
  assert.deepEqual(ps.map((p) => [p.key, p.points.length, p.undated]), [["language", 2, 0], ["agents", 1, 0], ["video", 1, 1]]);
});
