// Topic pages: one page per company, model or product, built from the names the classifier puts on each story.
// No extra LLM calls and no extra tables: stories are grouped by a normalized name, with spellings merged by config/entities.json.
import { getDb } from "./db.ts";
import { VISIBLE } from "./queries.ts";

import config from "../config/entities.json" with { type: "json" };

const ascii = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const ALIAS = new Map<string, string>();
for (const [slug, names] of Object.entries(config.aliases as Record<string, string[]>)) for (const n of names) ALIAS.set(n.toLowerCase().trim(), slug), ALIAS.set(ascii(n), slug);
ALIAS.delete("");

/** "Claude Opus 5.5" → "claude-opus-5-5"; aliases and Chinese names map to their page; "" when there is no page. */
export function entitySlug(name: string): string {
  const raw = name.toLowerCase().trim();
  return ALIAS.get(raw) ?? ALIAS.get(ascii(raw)) ?? ascii(raw);
}

/** A topic gets its own page (and a sitemap entry) from this many stories. */
export const MIN_STORIES = 3;

export interface EntityStory {
  id: number;
  first_seen_at: Date;
  item_type: string | null;
  category: string | null;
  has_controversy: boolean;
}

export interface Entity {
  slug: string;
  /** The spelling used most often. */
  name: string;
  stories: EntityStory[];
  /** Other topics named in the same stories, most shared first. */
  related: { slug: string; name: string; n: number }[];
}

/** All topics in visible stories of the last `days` days. Fine for tens of thousands of stories; move to SQL beyond that. */
export async function entityIndex(days = 180): Promise<Map<string, Entity>> {
  const db = await getDb();
  const rows = await db.query<EntityStory & { entities: string[] }>(
    `select id, entities, first_seen_at, item_type, category, has_controversy from events
      where ${VISIBLE} and slug is not null and first_seen_at > now() - make_interval(days => $1)
      order by first_seen_at desc`,
    [days],
  );
  const spellings = new Map<string, Map<string, number>>();
  const out = new Map<string, Entity>();
  const pairs = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const slugs = new Set<string>();
    for (const n of r.entities) {
      const s = entitySlug(n);
      if (!s) continue;
      slugs.add(s);
      const sp = spellings.get(s) ?? new Map<string, number>();
      sp.set(n, (sp.get(n) ?? 0) + 1);
      spellings.set(s, sp);
    }
    const story = { id: Number(r.id), first_seen_at: r.first_seen_at, item_type: r.item_type, category: r.category, has_controversy: r.has_controversy };
    for (const s of slugs) {
      if (!out.has(s)) out.set(s, { slug: s, name: s, stories: [], related: [] });
      out.get(s)!.stories.push(story);
      const p = pairs.get(s) ?? new Map<string, number>();
      for (const o of slugs) if (o !== s) p.set(o, (p.get(o) ?? 0) + 1);
      pairs.set(s, p);
    }
  }
  for (const [s, e] of out) {
    // Prefer Latin spellings for the page title: names stay in English on every edition.
    const sp = [...spellings.get(s)!].sort((a, b) => Number(/[a-z]/i.test(b[0])) - Number(/[a-z]/i.test(a[0])) || b[1] - a[1]);
    e.name = sp[0][0];
  }
  for (const [s, e] of out)
    e.related = [...(pairs.get(s) ?? [])]
      .filter(([o]) => (out.get(o)?.stories.length ?? 0) >= MIN_STORIES)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([o, n]) => ({ slug: o, name: out.get(o)!.name, n }));
  return out;
}

/** Topics with their own page, busiest in the last 30 days first. */
export async function listEntities(limit = 120): Promise<(Entity & { recent: number })[]> {
  const cutoff = Date.now() - 30 * 864e5;
  return [...(await entityIndex()).values()]
    .filter((e) => e.stories.length >= MIN_STORIES)
    .map((e) => ({ ...e, recent: e.stories.filter((s) => new Date(s.first_seen_at).getTime() > cutoff).length }))
    .sort((a, b) => b.recent - a.recent || b.stories.length - a.stories.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}
