import type { RawItem, SourceConfig } from "../types.ts";
import { clip, fetchText } from "../lib/util.ts";

/** GitHub has no trending API; parse the page. Each repo is an <article class="Box-row">. */
export function parseTrending(html: string, cfg: SourceConfig): RawItem[] {
  const out: RawItem[] = [];
  for (const block of html.split('<article class="Box-row">').slice(1)) {
    const repo = block.match(/<h2[^>]*>\s*<a[^>]*href="\/([^"]+)"/)?.[1];
    if (!repo) continue;
    const desc = block.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/)?.[1];
    const today = block.match(/([\d,]+) stars (today|this week)/)?.[1];
    out.push({
      sourceId: cfg.id,
      url: `https://github.com/${repo}`,
      title: `${repo}: ${clip(desc, 200) ?? ""}`.replace(/: $/, ""),
      excerpt: clip(desc, 500),
      engagement: today ? Number(today.replace(/,/g, "")) : 0,
    });
  }
  return out;
}

export async function fetchGithubTrending(cfg: SourceConfig): Promise<RawItem[]> {
  return parseTrending(await fetchText("https://github.com/trending?since=daily"), cfg);
}
