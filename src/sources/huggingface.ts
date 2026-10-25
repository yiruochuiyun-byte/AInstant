import type { RawItem, SourceConfig } from "../types.ts";
import { clip, fetchJson } from "../lib/util.ts";

interface HfModel {
  id: string;
  likes: number;
  downloads?: number;
  pipeline_tag?: string;
  createdAt?: string;
}

/** Trending models. Only models created in the last 14 days count as news. */
export async function fetchHfTrending(cfg: SourceConfig): Promise<RawItem[]> {
  const models = await fetchJson<HfModel[]>("https://huggingface.co/api/models?sort=trendingScore&limit=40");
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  return models
    .filter((m) => m.createdAt && Date.parse(m.createdAt) > cutoff)
    .map((m) => ({
      sourceId: cfg.id,
      url: `https://huggingface.co/${m.id}`,
      title: `${m.id}${m.pipeline_tag ? ` (${m.pipeline_tag})` : ""} is trending on Hugging Face`,
      publishedAt: m.createdAt ? new Date(m.createdAt) : undefined,
      engagement: m.likes,
    }));
}

interface DailyPaper {
  paper: { id: string; title: string; summary: string; upvotes: number; publishedAt: string };
}

/** arXiv papers that the community upvoted on HF Daily Papers: a curated slice of arXiv instead of the raw firehose. */
export async function fetchHfPapers(cfg: SourceConfig): Promise<RawItem[]> {
  const papers = await fetchJson<DailyPaper[]>("https://huggingface.co/api/daily_papers?limit=50");
  return papers
    .filter((p) => p.paper.upvotes >= 10)
    .map((p) => ({
      sourceId: cfg.id,
      url: `https://arxiv.org/abs/${p.paper.id}`,
      title: p.paper.title,
      excerpt: clip(p.paper.summary, 500),
      publishedAt: new Date(p.paper.publishedAt),
      engagement: p.paper.upvotes,
      discussionUrl: `https://huggingface.co/papers/${p.paper.id}`,
    }));
}
