import type { RawItem, SourceConfig } from "../../lib/types.ts";
import { clip, fetchJson } from "../../lib/util.ts";

interface Post {
  data: {
    title: string;
    url: string;
    permalink: string;
    selftext: string;
    author: string;
    score: number;
    num_comments: number;
    created_utc: number;
    is_self: boolean;
    stickied: boolean;
  };
}

/** Hot posts from one subreddit (cfg.url = subreddit name). Link posts point at the link; self posts at the thread. */
export async function fetchReddit(cfg: SourceConfig): Promise<RawItem[]> {
  const { data } = await fetchJson<{ data: { children: Post[] } }>(
    `https://www.reddit.com/r/${cfg.url}/hot.json?limit=50&raw_json=1`,
  );
  return data.children
    .map((c) => c.data)
    .filter((p) => !p.stickied && p.score >= 30)
    .map((p) => {
      const thread = `https://www.reddit.com${p.permalink}`;
      const external = !p.is_self && !/^https:\/\/(i|v|www)\.redd/.test(p.url);
      return {
        sourceId: cfg.id,
        url: external ? p.url : thread,
        title: p.title,
        excerpt: clip(p.selftext, 500),
        author: p.author,
        publishedAt: new Date(p.created_utc * 1000),
        engagement: p.score + p.num_comments,
        discussionUrl: thread,
      };
    });
}
