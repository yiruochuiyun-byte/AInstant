import { readFileSync } from "node:fs";
import type { RawItem, SourceConfig } from "../types.ts";
import type { Db } from "../lib/db.ts";
import { fetchJson, offline } from "../lib/util.ts";

interface OrModel {
  id: string;
  name: string;
  created: number;
  context_length: number;
  pricing: { prompt: string; completion: string };
}

const perM = (perToken: string) => Math.round(Number(perToken) * 1e6 * 1e4) / 1e4;

/**
 * Snapshot OpenRouter's model list and turn the diff into news: new models and price cuts.
 * Snapshots also feed the price tracker page.
 */
export async function fetchOpenRouter(cfg: SourceConfig, db: Db): Promise<RawItem[]> {
  const payload: { data: OrModel[] } = offline()
    ? JSON.parse(readFileSync(new URL("../../fixtures/openrouter.json", import.meta.url), "utf8"))
    : await fetchJson("https://openrouter.ai/api/v1/models");

  const last = await db.query<{ model_id: string; prompt: string; completion: string }>(
    `select distinct on (model_id) model_id, prompt_usd_per_m::text as prompt, completion_usd_per_m::text as completion
       from price_snapshots order by model_id, captured_at desc`,
  );
  const prev = new Map(last.map((r) => [r.model_id, r]));
  const firstRun = prev.size === 0;
  const day = new Date().toISOString().slice(0, 10);
  const items: RawItem[] = [];

  for (const m of payload.data) {
    const prompt = perM(m.pricing.prompt);
    const completion = perM(m.pricing.completion);
    const before = prev.get(m.id);
    const changed = !before || Number(before.prompt) !== prompt || Number(before.completion) !== completion;
    if (changed) {
      await db.query(
        `insert into price_snapshots (model_id, name, prompt_usd_per_m, completion_usd_per_m, context_length)
         values ($1, $2, $3, $4, $5)`,
        [m.id, m.name, prompt, completion, m.context_length],
      );
    }
    const url = `https://openrouter.ai/${m.id}`;
    if (!before && !firstRun) {
      items.push({
        sourceId: cfg.id,
        url,
        title: `${m.name} is now on OpenRouter ($${prompt}/M input, $${completion}/M output, ${m.context_length.toLocaleString("en")} context)`,
        publishedAt: new Date(m.created * 1000),
      });
    } else if (before && prompt > 0 && prompt < Number(before.prompt) * 0.9) {
      items.push({
        sourceId: cfg.id,
        url,
        dedupeKey: `${url}#price-${day}`,
        title: `${m.name} price cut on OpenRouter: input $${before.prompt} → $${prompt}/M, output $${before.completion} → $${completion}/M`,
        publishedAt: new Date(),
      });
    }
  }
  return items;
}
