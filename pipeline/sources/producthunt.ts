import type { RawItem, SourceConfig } from "../../lib/types.ts";
import { parseFeed } from "./rss.ts";
import { fetchText } from "../../lib/util.ts";

/** Product Hunt's public feed of featured launches; the AI prefilter and the LLM keep only AI products. */
export async function fetchProductHunt(cfg: SourceConfig): Promise<RawItem[]> {
  return parseFeed(await fetchText(cfg.url ?? "https://www.producthunt.com/feed"), cfg).filter((i) => i.url && i.title);
}
