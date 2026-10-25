import * as llm from "../lib/llm.ts";
import * as mock from "../lib/mock.ts";
import { embed } from "../lib/embed.ts";
import { offline } from "../lib/util.ts";

/** Everything that costs money or needs the network, swappable for offline runs and tests. */
export interface Brain {
  classify: typeof llm.classify;
  sameEvent: typeof llm.sameEvent;
  summarizeEvent: typeof llm.summarizeEvent;
  embed: typeof embed;
  /** Cosine similarity cut-offs for clustering; see cluster.ts. Tune on a week of real data. */
  thresholds: { join: number; check: number };
}

export const realBrain: Brain = {
  classify: llm.classify,
  sameEvent: llm.sameEvent,
  summarizeEvent: llm.summarizeEvent,
  embed,
  thresholds: { join: 0.86, check: 0.7 },
};

// Bag-of-words vectors score much lower than real embeddings, hence the lower cut-offs.
export const mockBrain: Brain = {
  classify: mock.mockClassify,
  sameEvent: mock.mockSameEvent,
  summarizeEvent: mock.mockSummarizeEvent,
  embed: mock.mockEmbed,
  thresholds: { join: 0.6, check: 0.2 },
};

export function pickBrain(): Brain {
  if (offline()) return mockBrain;
  const missing = ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY"].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing ${missing.join(", ")} (set AINSTANT_OFFLINE=1 to run on fixtures)`);
  return realBrain;
}
