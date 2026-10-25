import type { RawItem, SourceConfig } from "../../lib/types.ts";
import { fetchJson } from "../../lib/util.ts";

interface Hit {
  objectID: string;
  title: string;
  url: string | null;
  author: string;
  points: number;
  num_comments: number;
  created_at_i: number;
}

/** Stories from the last 24h with some traction, via the Algolia HN API. */
export async function fetchHn(cfg: SourceConfig): Promise<RawItem[]> {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=200&numericFilters=points>=20,created_at_i>${since}`;
  const { hits } = await fetchJson<{ hits: Hit[] }>(url);
  return hits.map((h) => {
    const thread = `https://news.ycombinator.com/item?id=${h.objectID}`;
    return {
      sourceId: cfg.id,
      url: h.url ?? thread,
      title: h.title,
      author: h.author,
      publishedAt: new Date(h.created_at_i * 1000),
      engagement: h.points + h.num_comments,
      discussionUrl: thread,
    };
  });
}
