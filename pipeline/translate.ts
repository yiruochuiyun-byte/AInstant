import { readFileSync } from "node:fs";
import type { Db } from "../lib/db.ts";
import type { Brain } from "./brain.ts";
import { sha } from "../lib/url.ts";
import { log } from "../lib/util.ts";
import { LANGS } from "../config/site.ts";

const glossary = JSON.parse(readFileSync(new URL("../config/glossary.json", import.meta.url), "utf8")) as {
  keep: string[];
  terms: Record<string, Record<string, string>>;
};

interface Text {
  entity_type: "event" | "item";
  entity_id: number;
  field: "title" | "why" | "summary";
  text: string;
}

/**
 * Translate what readers can see (events with heat or approved in the last 7 days, and their items),
 * one LLM call per event and language. Cached by source hash: unchanged English is never re-translated.
 */
export async function translateVisible(db: Db, brain: Brain, limit = 100): Promise<number> {
  const events = await db.query<{ id: number; title_en: string; why_en: string | null }>(
    `select id, title_en, why_en from events
      where status in ('auto', 'approved') and (hotness > 0 or last_item_at > now() - interval '7 days')
      order by hotness desc limit $1`,
    [limit],
  );
  let translated = 0;
  for (const ev of events) {
    const items = await db.query<{ id: number; summary_en: string }>(`select id, summary_en from items where event_id = $1`, [ev.id]);
    const texts: Text[] = [
      { entity_type: "event", entity_id: ev.id, field: "title", text: ev.title_en },
      ...(ev.why_en ? [{ entity_type: "event" as const, entity_id: ev.id, field: "why" as const, text: ev.why_en }] : []),
      ...items.map((i) => ({ entity_type: "item" as const, entity_id: i.id, field: "summary" as const, text: i.summary_en })),
    ];
    for (const lang of LANGS.filter((l) => l !== "en")) {
      const cached = await db.query<{ k: string }>(
        `select entity_type || ':' || entity_id || ':' || field || ':' || source_hash as k from translations
          where lang = $1 and ((entity_type = 'event' and entity_id = $2) or (entity_type = 'item' and entity_id = any($3::bigint[])))`,
        [lang, ev.id, items.map((i) => i.id)],
      );
      const have = new Set(cached.map((c) => c.k));
      const key = (t: Text) => `${t.entity_type}:${t.entity_id}:${t.field}`;
      const todo = texts.filter((t) => !have.has(`${key(t)}:${sha(t.text)}`));
      if (todo.length === 0) continue;
      try {
        const out = await brain.translate({
          lang,
          glossary: { keep: glossary.keep, terms: glossary.terms[lang] ?? {} },
          texts: todo.map((t) => ({ key: key(t), text: t.text })),
        });
        for (const t of todo) {
          const text = out[key(t)];
          if (!text) continue;
          await db.query(
            `insert into translations (entity_type, entity_id, field, lang, source_hash, text) values ($1, $2, $3, $4, $5, $6)
             on conflict (entity_type, entity_id, field, lang) do update set source_hash = excluded.source_hash, text = excluded.text, created_at = now()`,
            [t.entity_type, t.entity_id, t.field, lang, sha(t.text), text],
          );
          translated++;
        }
      } catch (err) {
        log(`translate event ${ev.id} to ${lang} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  return translated;
}
