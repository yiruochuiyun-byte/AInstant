// Model registry for the homepage dot plot: one row per model and modality, scored by Artificial Analysis.
// Free API, 1,000 requests/day, attribution required (the chart links to artificialanalysis.ai).
import { readFileSync } from "node:fs";
import type { Db } from "../lib/db.ts";
import { fetchJson, log, offline } from "../lib/util.ts";

export const MODALITIES = ["language", "image", "video", "voice"] as const;
export type Modality = (typeof MODALITIES)[number];

const AA = "https://artificialanalysis.ai/api/v2";
const BOARDS: { modality: Modality; path: string; fixture: string }[] = [
  { modality: "language", path: "/language/models/free", fixture: "aa-language" },
  { modality: "image", path: "/media/text-to-image/models/free", fixture: "aa-image" },
  { modality: "video", path: "/media/text-to-video/models/free", fixture: "aa-video" },
  { modality: "voice", path: "/media/text-to-speech/models/free", fixture: "aa-voice" },
];
const SYNC_EVERY_H = 12;

interface AaRow {
  name: string;
  model_creator?: { name?: string };
  release_date?: string | null;
  elo?: number;
  evaluations?: { artificial_analysis_intelligence_index?: number | null; artificial_analysis_agentic_index?: number | null };
}
interface AaPage {
  data: AaRow[];
  pagination?: { has_more: boolean };
}

/** "GPT-5.1 (high)" and "GPT 5.1 (low)" are one model on the chart. */
export const normName = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9.]+/g, "");

async function fetchBoard(b: (typeof BOARDS)[number]): Promise<AaRow[]> {
  if (offline()) return (JSON.parse(readFileSync(new URL(`../fixtures/${b.fixture}.json`, import.meta.url), "utf8")) as AaPage).data;
  const headers = { "x-api-key": process.env.ARTIFICIAL_ANALYSIS_API_KEY! };
  const rows: AaRow[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetchJson<AaPage>(`${AA}${b.path}?page=${page}`, { headers });
    rows.push(...res.data);
    if (!res.pagination?.has_more) break;
  }
  return rows;
}

interface Merged {
  key: string;
  name: string;
  creator: string | null;
  released: string | null;
  score: number | null;
  agentic: number | null;
}

/** Collapse effort variants into one row per model, keeping the best score. */
export function mergeVariants(modality: Modality, rows: AaRow[]): Merged[] {
  const out = new Map<string, Merged>();
  for (const r of rows) {
    const score = modality === "language" ? (r.evaluations?.artificial_analysis_intelligence_index ?? null) : (r.elo ?? null);
    if (score == null) continue;
    const key = normName(r.name);
    const m = out.get(key);
    const agentic = r.evaluations?.artificial_analysis_agentic_index ?? null;
    if (!m) {
      out.set(key, { key, name: r.name.replace(/\s*\([^)]*\)\s*/g, " ").trim(), creator: r.model_creator?.name ?? null, released: r.release_date ?? null, score, agentic });
    } else {
      m.score = Math.max(m.score!, score);
      if (agentic != null) m.agentic = Math.max(m.agentic ?? 0, agentic);
      m.released ??= r.release_date ?? null;
    }
  }
  return [...out.values()];
}

export async function syncModels(db: Db, now = new Date(), force = false): Promise<Record<string, number> | null> {
  if (!offline() && !process.env.ARTIFICIAL_ANALYSIS_API_KEY) return null;
  const [last] = await db.query<{ value: string }>(`select value from meta where key = 'models_synced_at'`);
  if (!force && last && now.getTime() - Date.parse(last.value) < SYNC_EVERY_H * 3600_000) return null;

  const stats: Record<string, number> = {};
  for (const b of BOARDS) {
    let rows: Merged[];
    try {
      rows = mergeVariants(b.modality, await fetchBoard(b));
    } catch (err) {
      log("models", b.modality, String(err));
      continue;
    }
    // On the first import of a board we cannot tell new from old, so models without a date stay undated.
    const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from models where modality = $1`, [b.modality]);
    const seenBefore = n > 0;
    for (const r of rows) {
      await db.query(
        `insert into models (ext_id, name, creator, modality, released_on, score, agentic_score, score_source, first_seen_at)
         values ($1, $2, $3, $4, coalesce($5::date, case when $9 then $8::timestamptz::date end), $6, $7, 'Artificial Analysis', $8)
         on conflict (ext_id) do update set name = excluded.name, creator = excluded.creator, score = excluded.score,
           agentic_score = excluded.agentic_score, released_on = coalesce($5::date, models.released_on), updated_at = $8`,
        [`aa:${b.modality}:${r.key}`, r.name, r.creator, b.modality, r.released, r.score, r.agentic, now.toISOString(), seenBefore],
      );
    }
    stats[b.modality] = rows.length;
  }
  await datesFromNews(db);
  await db.query(
    `insert into meta (key, value) values ('models_synced_at', $1) on conflict (key) do update set value = excluded.value`,
    [now.toISOString()],
  );
  return stats;
}

/** Undated models get the date we first reported their launch, when an event names them. */
export async function datesFromNews(db: Db): Promise<number> {
  const undated = await db.query<{ id: number; name: string }>(`select id, name from models where released_on is null`);
  if (!undated.length) return 0;
  const launches = await db.query<{ entities: string[]; first_seen_at: Date }>(
    `select entities, first_seen_at from events where category = 'models' and item_type in ('launch', 'upgrade') order by first_seen_at`,
  );
  let n = 0;
  for (const m of undated) {
    const key = normName(m.name);
    const hit = launches.find((e) => e.entities.some((x) => normName(x) === key));
    if (!hit) continue;
    await db.query(`update models set released_on = $2::timestamptz::date where id = $1`, [m.id, new Date(hit.first_seen_at).toISOString()]);
    n++;
  }
  return n;
}
