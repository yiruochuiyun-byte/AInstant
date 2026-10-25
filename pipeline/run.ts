import { connect, migrate, type Db } from "../lib/db.ts";
import { SOURCES } from "../config/sources.ts";
import { pickBrain, type Brain } from "./brain.ts";
import { ingest, syncSources } from "./ingest.ts";
import { classifyNew, embedLabeled } from "./classify.ts";
import { cluster } from "./cluster.ts";
import { refreshEvents } from "./events.ts";
import { rank } from "./rank.ts";
import { translateVisible } from "./translate.ts";
import { log } from "../lib/util.ts";

/** One pipeline pass: fetch → dedupe → label → embed → cluster → headline → rank. */
export async function runOnce(db: Db, brain: Brain, sources = SOURCES, now = new Date()) {
  const [run] = await db.query<{ id: number }>(`insert into runs default values returning id`);
  await syncSources(db, sources);
  const ingested = await ingest(db, sources);
  log("ingest", ingested);
  const classified = await classifyNew(db, brain);
  log("classify", classified);
  const embedded = await embedLabeled(db, brain);
  const clustered = await cluster(db, brain);
  log("cluster", { embedded, ...clustered });
  const refreshed = await refreshEvents(db, brain);
  const ranked = await rank(db, now);
  const translated = await translateVisible(db, brain);
  log("events", { refreshed, ranked, translated });
  const stats = { ingested, classified, embedded, clustered, refreshed, ranked, translated };
  await db.query(`update runs set finished_at = now(), stats = $2 where id = $1`, [run.id, JSON.stringify(stats)]);
  return stats;
}

if (import.meta.main) {
  const db = await connect();
  try {
    await migrate(db);
    await runOnce(db, pickBrain());
  } finally {
    await db.close();
  }
}
