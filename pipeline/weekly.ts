// AInstant Weekly. On Monday (UTC) the pipeline builds a draft issue for the ISO week that just ended:
// top stories by peak heat, the rest of the week's notable stories, section counts, rising tags, new models
// and a short LLM-written overview (one cheap call per issue, plus one translation call per language).
// An editor checks the draft in the admin; the issue is published and mailed only once approved.
import { readFileSync } from "node:fs";
import type { Db } from "../lib/db.ts";
import type { Brain } from "./brain.ts";
import { VISIBLE } from "../lib/queries.ts";
import { sha } from "../lib/url.ts";
import { log } from "../lib/util.ts";
import { LANGS } from "../config/site.ts";

export const TOP_N = 5;
const MORE_N = 10;
const DAY = 864e5;

export interface WeeklyStats {
  sections: { category: string; now: number; before: number }[];
  tags: { tag: string; now: number; before: number }[];
  models: { name: string; creator: string | null; modality: string; score: number | null; agentic_score: number | null; open_weights: boolean | null; released_on: string }[];
}

/** ISO 8601 week of a date (weeks start on Monday, UTC). */
export function isoWeek(d: Date): { week: string; start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  const thursday = new Date(start.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const n = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return { week: `${year}-W${String(n).padStart(2, "0")}`, start, end: new Date(start.getTime() + 7 * DAY) };
}

/** "2026-W43" → that week's bounds, or null when malformed. */
export function parseWeek(week: string): { week: string; start: Date; end: Date } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  // January 4th is always in week 1.
  const w1 = isoWeek(new Date(Date.UTC(Number(m[1]), 0, 4)));
  const w = isoWeek(new Date(w1.start.getTime() + (Number(m[2]) - 1) * 7 * DAY));
  return w.week === week ? w : null;
}

/** Build the draft for the last finished week, once. Returns its week id, or null when it exists or the week had no stories. */
export async function buildWeekly(db: Db, brain: Brain, now = new Date()): Promise<string | null> {
  const target = isoWeek(new Date(isoWeek(now).start.getTime() - DAY));
  const [exists] = await db.query(`select 1 from weeklies where week = $1`, [target.week]);
  if (exists) return null;
  const { start, end } = target;
  const prevStart = new Date(start.getTime() - 7 * DAY);

  const stories = await db.query<{ id: number; title_en: string; why_en: string | null; has_controversy: boolean }>(
    `select id, title_en, why_en, has_controversy from events
      where ${VISIBLE} and slug is not null and first_seen_at >= $1 and first_seen_at < $2
      order by greatest(peak_hotness, hotness) desc, source_count desc, id
      limit ${TOP_N + MORE_N}`,
    [start, end],
  );
  if (stories.length === 0) return null;

  const sections = await db.query<WeeklyStats["sections"][number]>(
    `select category, count(*) filter (where first_seen_at >= $2)::int as now, count(*) filter (where first_seen_at < $2)::int as before
       from events where ${VISIBLE} and category is not null and first_seen_at >= $1 and first_seen_at < $3
      group by 1 order by 2 desc, 1`,
    [prevStart, start, end],
  );
  const tags = await db.query<WeeklyStats["tags"][number]>(
    `select tag, count(*) filter (where first_seen_at >= $2)::int as now, count(*) filter (where first_seen_at < $2)::int as before
       from events, unnest(tags) as tag
      where ${VISIBLE} and first_seen_at >= $1 and first_seen_at < $3
      group by tag
     having count(*) filter (where first_seen_at >= $2) >= 2
      order by (count(*) filter (where first_seen_at >= $2) - count(*) filter (where first_seen_at < $2)) desc, tag
      limit 8`,
    [prevStart, start, end],
  );
  const models = await db.query<WeeklyStats["models"][number]>(
    `select name, creator, modality, score, agentic_score, open_weights, to_char(released_on, 'YYYY-MM-DD') as released_on
       from models where released_on >= $1::date and released_on < $2::date
      order by modality, score desc nulls last limit 20`,
    [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
  );

  const top = stories.slice(0, TOP_N);
  let intro: string | null = null;
  try {
    intro = await brain.weeklyIntro({
      week: target.week,
      stories: top.map((s) => ({ title: s.title_en, why: s.why_en, disputed: s.has_controversy })),
      new_models: models.map((m) => m.name),
      rising_tags: tags.map((t) => t.tag),
    });
  } catch (err) {
    // The editor can write it in the admin.
    log(`weekly intro failed: ${err instanceof Error ? err.message : err}`);
  }
  const stats: WeeklyStats = { sections, tags, models };
  await db.query(
    `insert into weeklies (week, starts_at, ends_at, intro_en, top_ids, more_ids, stats) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (week) do nothing`,
    [target.week, start, end, intro, top.map((s) => s.id), stories.slice(TOP_N).map((s) => s.id), JSON.stringify(stats)],
  );
  return target.week;
}

const glossary = JSON.parse(readFileSync(new URL("../config/glossary.json", import.meta.url), "utf8")) as {
  keep: string[];
  terms: Record<string, Record<string, string>>;
};

/** Translate the overview of recent issues; cached by source hash like everything else. */
export async function translateWeeklies(db: Db, brain: Brain): Promise<number> {
  const issues = await db.query<{ id: number; intro_en: string }>(
    `select id, intro_en from weeklies where intro_en is not null and created_at > now() - interval '30 days'`,
  );
  let n = 0;
  for (const w of issues) {
    for (const lang of LANGS.filter((l) => l !== "en")) {
      const [have] = await db.query(
        `select 1 from translations where entity_type = 'weekly' and entity_id = $1 and field = 'intro' and lang = $2 and source_hash = $3`,
        [w.id, lang, sha(w.intro_en)],
      );
      if (have) continue;
      try {
        const out = await brain.translate({
          lang,
          glossary: { keep: glossary.keep, terms: glossary.terms[lang] ?? {} },
          texts: [{ key: "intro", text: w.intro_en }],
        });
        if (!out.intro) continue;
        await db.query(
          `insert into translations (entity_type, entity_id, field, lang, source_hash, text) values ('weekly', $1, 'intro', $2, $3, $4)
           on conflict (entity_type, entity_id, field, lang) do update set source_hash = excluded.source_hash, text = excluded.text, created_at = now()`,
          [w.id, lang, sha(w.intro_en), out.intro],
        );
        n++;
      } catch (err) {
        log(`translate weekly ${w.id} to ${lang} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  return n;
}
