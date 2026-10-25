// Stand-ins for the LLM and embedding APIs, used in offline mode and tests.
// Deterministic and crude on purpose: they exercise the pipeline, they do not judge news.
import { createHash } from "node:crypto";
import type { Classification, ClassifyInput, EventSummary, TimelineEntry } from "./llm.ts";
import { EMBED_DIM } from "./embed.ts";
import { AI_KEYWORDS } from "../../config/keywords.ts";
import { sharesEntity } from "../pipeline/cluster.ts";

const STOP = new Set("The A An And Or Of In On For To With Is Are New How Why What We I Our Its It This That Show Ask Launch HN Now Tested M".split(" "));

export function mockEntities(text: string): string[] {
  const found = text.match(/\b[A-Z][\w.]*(?:[-\s][A-Z0-9][\w.]*)*/g) ?? [];
  return [...new Set(found.map((s) => s.trim()).filter((s) => !STOP.has(s)))].slice(0, 6);
}

export async function mockClassify(i: ClassifyInput): Promise<Classification> {
  const t = `${i.title} ${i.excerpt ?? ""}`;
  const reject = /\b(raises|funding|series [a-e]|valuation|acquires?)\b/i.test(t)
    ? "funding"
    : /regulat|senate|parliament|eu ai act|executive order/i.test(t)
      ? "policy"
      : !AI_KEYWORDS.test(t)
        ? "not_ai"
        : "none";
  const node_type = /respond|statement|clarif|回应|addresses/i.test(t)
    ? "official_response"
    : /mislead|accus|cherry|questions?|doubt|controvers|质疑|criticis/i.test(t)
      ? "criticism"
      : /tested|hands-on|benchmark|tried|实测|first impressions/i.test(t)
        ? "early_test"
        : "announcement";
  return {
    relevant: reject === "none",
    reject_reason: reject,
    category: /open[- ]?source|weights|github|hugging ?face/i.test(t) ? "open_source" : "models",
    item_type: /price|cheaper|降价/i.test(t) ? "price_cut" : node_type === "criticism" ? "incident" : "launch",
    tags: /speech|voice|语音/i.test(t) ? ["speech"] : /cod(e|ing)/i.test(t) ? ["coding"] : [],
    node_type,
    claim_type: node_type === "criticism" ? "allegation" : node_type === "early_test" ? "opinion" : "fact",
    summary_en: i.title,
    entities: mockEntities(i.title),
  };
}

/** Same story if they share a product-like name (has a digit or hyphen), not just the company. */
export async function mockSameEvent(e: { entities: string[] }, i: { entities: string[] }): Promise<boolean> {
  const productish = (xs: string[]) => xs.filter((x) => /[\d-]/.test(x));
  return sharesEntity(productish(e.entities), productish(i.entities));
}

export async function mockSummarizeEvent(t: TimelineEntry[]): Promise<EventSummary> {
  const first = t.find((x) => x.node_type === "announcement") ?? t[0];
  return {
    title_en: first.summary.slice(0, 90),
    why_en: `Covered by ${new Set(t.map((x) => x.source)).size} sources so far.`,
    category: "models",
    item_type: "launch",
    tags: [],
  };
}

/** Hashed bag of words (plus CJK bigrams), L2-normalized. */
export async function mockEmbed(texts: string[]): Promise<number[][]> {
  return texts.map((text) => {
    const v = new Array(EMBED_DIM).fill(0);
    const words = text.toLowerCase().match(/[a-z0-9][a-z0-9.-]*|[一-鿿]{2}/g) ?? [];
    for (const w of words.flatMap((w) => (w.includes("-") ? [w, ...w.split("-")] : [w]))) {
      if (w.length < 3 && !/[一-鿿]/.test(w)) continue;
      const h = createHash("md5").update(w).digest();
      v[h.readUInt16BE(0) % EMBED_DIM] += 1;
    }
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  });
}
