import type { Db } from "../lib/db.ts";

export interface HotnessInput {
  /** Weight of each distinct source that carried or discussed the story. */
  sourceWeights: number[];
  /** Distinct platforms (rss, hn, reddit, x...). Being talked about in several places matters more than volume in one. */
  platforms: number;
  /** Points, upvotes, comments, stars, summed. */
  engagement: number;
  hoursSinceLast: number;
  hoursSinceFirst: number;
}

const HALF_LIFE_H = 18;

export function hotness(x: HotnessInput): number {
  const breadth = x.sourceWeights.reduce((a, b) => a + b, 0) * (1 + 0.25 * Math.max(0, x.platforms - 1));
  const buzz = 1 + Math.log10(1 + Math.max(0, x.engagement)) / 2;
  // New developments keep a story alive, but an old story with one late reply should not jump back to the top.
  const age = 0.7 * x.hoursSinceLast + 0.3 * x.hoursSinceFirst;
  return Math.round(breadth * buzz * Math.pow(0.5, age / HALF_LIFE_H) * 1000) / 1000;
}

/** Recompute hotness for events active in the last 72h; older events fall to zero. */
export async function rank(db: Db, now = new Date()): Promise<number> {
  const rows = await db.query<{ id: number; weights: number[]; platforms: string; engagement: string; first: Date; last: Date }>(
    `with appearances as (
       select i.event_id, i.source_id, i.engagement from items i where i.event_id is not null
       union all
       select i.event_id, m.source_id, m.engagement from mentions m join items i on i.url_hash = m.url_hash where i.event_id is not null
     )
     select e.id,
            (select array_agg(s.weight) from sources s where s.id in (select source_id from appearances a where a.event_id = e.id)) as weights,
            (select count(distinct s.kind) from appearances a join sources s on s.id = a.source_id where a.event_id = e.id) as platforms,
            (select coalesce(sum(a.engagement), 0) from appearances a where a.event_id = e.id) as engagement,
            e.first_seen_at as first, e.last_item_at as last
       from events e
      where e.last_item_at > $1::timestamptz - interval '72 hours'`,
    [now],
  );
  const hours = (d: Date) => Math.max(0, (now.getTime() - new Date(d).getTime()) / 3.6e6);
  for (const r of rows) {
    const h = hotness({
      sourceWeights: (r.weights ?? []).map(Number),
      platforms: Number(r.platforms),
      engagement: Number(r.engagement),
      hoursSinceLast: hours(r.last),
      hoursSinceFirst: hours(r.first),
    });
    await db.query(`update events set hotness = $2 where id = $1`, [r.id, h]);
  }
  await db.query(`update events set hotness = 0 where hotness > 0 and last_item_at <= $1::timestamptz - interval '72 hours'`, [now]);
  return rows.length;
}
