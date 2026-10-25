import { existsSync, readFileSync } from "node:fs";
import type { RawItem, SourceConfig, SourceKind } from "../../lib/types.ts";
import type { Db } from "../../lib/db.ts";
import { offline } from "../../lib/util.ts";
import { fetchRss } from "./rss.ts";
import { fetchHn } from "./hn.ts";
import { fetchReddit } from "./reddit.ts";
import { fetchHfPapers, fetchHfTrending } from "./huggingface.ts";
import { fetchGithubTrending } from "./github.ts";
import { fetchOpenRouter } from "./openrouter.ts";
import { fetchInbox } from "./inbox.ts";

type Adapter = (cfg: SourceConfig, db: Db) => Promise<RawItem[]>;

const ADAPTERS: Record<SourceKind, Adapter> = {
  rss: fetchRss,
  hn: fetchHn,
  reddit: fetchReddit,
  huggingface: fetchHfTrending,
  hf_papers: fetchHfPapers,
  github_trending: fetchGithubTrending,
  openrouter: fetchOpenRouter,
  inbox: fetchInbox,
};

/** Network-free mode: read fixtures/<source id>.json instead of calling the source. */
function fromFixture(cfg: SourceConfig): RawItem[] {
  const path = new URL(`../../fixtures/${cfg.id}.json`, import.meta.url);
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf8")) as RawItem[]).map((i) => ({
    ...i,
    sourceId: cfg.id,
    publishedAt: i.publishedAt ? new Date(i.publishedAt) : undefined,
  }));
}

export async function fetchSource(cfg: SourceConfig, db: Db): Promise<RawItem[]> {
  if (offline() && cfg.kind !== "openrouter") return fromFixture(cfg);
  return ADAPTERS[cfg.kind](cfg, db);
}
