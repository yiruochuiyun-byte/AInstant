import { test } from "node:test";
import assert from "node:assert/strict";
import { connect, migrate } from "../lib/db.ts";
import { mockBrain } from "../pipeline/brain.ts";
import { buildWeekly, isoWeek, parseWeek, translateWeeklies } from "../pipeline/weekly.ts";

process.env.AINSTANT_OFFLINE = "1";

test("ISO weeks", () => {
  assert.equal(isoWeek(new Date("2026-10-25T23:00:00Z")).week, "2026-W43"); // Sunday
  assert.equal(isoWeek(new Date("2026-10-26T00:00:00Z")).week, "2026-W44"); // Monday
  assert.equal(isoWeek(new Date("2027-01-01T12:00:00Z")).week, "2026-W53");
  assert.equal(isoWeek(new Date("2025-12-29T12:00:00Z")).week, "2026-W01");
  assert.equal(parseWeek("2026-W43")!.start.toISOString(), "2026-10-19T00:00:00.000Z");
  assert.equal(parseWeek("2026-W54"), null);
  assert.equal(parseWeek("2026-43"), null);
});

test("weekly issue: built once, top stories by peak heat, sent instead of the daily", async () => {
  const db = await connect({ memory: true });
  await migrate(db);
  (globalThis as { __ainstantDb?: Promise<typeof db> }).__ainstantDb = Promise.resolve(db);
  const add = (title: string, at: string, peak: number, status = "auto", tags: string[] = ["coding"]) =>
    db.query(
      `insert into events (slug, title_en, why_en, category, item_type, tags, status, peak_hotness, first_seen_at, last_item_at, source_count)
       values ($1, $2, 'Because.', 'models', 'launch', $5, $3, $4, $6, $6, 2)`,
      [title.toLowerCase().replace(/\W+/g, "-"), title, status, peak, tags, at],
    );
  for (let i = 1; i <= 8; i++) await add(`Story ${i}`, `2026-10-2${i % 6}T10:00:00Z`, i);
  await add("Disputed and unreviewed", "2026-10-21T10:00:00Z", 99, "pending_review");
  await add("Week before", "2026-10-14T10:00:00Z", 50);
  await add("This week", "2026-10-26T10:00:00Z", 50);
  await db.query(`insert into models (ext_id, name, creator, modality, released_on, score) values ('m:1', 'Orca 5', 'Lumen Labs', 'language', '2026-10-22', 60)`);

  const monday = new Date("2026-10-26T03:00:00Z");
  assert.equal(await buildWeekly(db, mockBrain, monday), "2026-W43");
  assert.equal(await buildWeekly(db, mockBrain, monday), null, "built only once");

  const [w] = await db.query<{ top: string[]; more: string[]; intro_en: string; stats: { models: { name: string }[]; sections: { now: number; before: number }[] } }>(
    `select (select array_agg(e.title_en order by k) from unnest(top_ids) with ordinality u(id, k) join events e on e.id = u.id) as top,
            (select array_agg(e.title_en) from unnest(more_ids) u(id) join events e on e.id = u.id) as more, intro_en, stats
       from weeklies`,
  );
  assert.deepEqual(w.top, ["Story 8", "Story 7", "Story 6", "Story 5", "Story 4"]);
  assert.equal(w.more.length, 3);
  assert.ok(!w.top.includes("Disputed and unreviewed") && !w.more.includes("Week before"));
  assert.match(w.intro_en, /Story 8/);
  assert.deepEqual(w.stats.models.map((m) => m.name), ["Orca 5"]);
  assert.deepEqual(w.stats.sections[0], { category: "models", now: 8, before: 1 });

  assert.equal(await translateWeeklies(db, mockBrain), 1);
  assert.equal(await translateWeeklies(db, mockBrain), 0, "cached");

  // Two subscribers in Shanghai: one daily, one weekly-only. 00:30 UTC is 8:30 there.
  await db.query(`insert into subscribers (email, lang, timezone, token, confirmed_at, frequency) values
    ('d@example.com', 'zh', 'Asia/Shanghai', 't1', now(), 'daily'), ('w@example.com', 'en', 'Asia/Shanghai', 't2', now(), 'weekly')`);
  const { sendDue } = await import("../pipeline/digest.ts");
  // The daily email looks at the wall clock; keep it out of this test.
  await db.query(`update events set last_item_at = '2026-01-01'`);
  const tuesday = new Date("2026-10-27T00:30:00Z");
  assert.equal(await sendDue(tuesday), 0, "nothing before the issue is approved");
  await db.query(`update weeklies set status = 'approved', approved_at = $1`, [new Date("2026-10-26T09:00:00Z")]);
  assert.equal(await sendDue(tuesday), 2);
  const subs = await db.query<{ last_weekly: string }>(`select last_weekly from subscribers order by email`);
  assert.deepEqual(subs.map((s) => s.last_weekly), ["2026-W43", "2026-W43"]);
  assert.equal(await sendDue(tuesday), 0, "not twice");
  await db.close();
});
