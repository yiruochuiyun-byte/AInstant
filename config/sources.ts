import type { SourceConfig } from "../lib/types.ts";

// Source list. weight: how much one appearance moves hotness (official 3, strong community 2, general 1).
// URLs marked "verify" have not been fetched yet; the first real run reports any that fail in sources.last_error.
const RSSHUB = process.env.RSSHUB_URL ?? "";

export const SOURCES: SourceConfig[] = [
  // Official blogs and changelogs
  { id: "openai-news", kind: "rss", name: "OpenAI News", url: "https://openai.com/news/rss.xml", weight: 3, credibility: "official", aiOnly: true },
  { id: "deepmind-blog", kind: "rss", name: "Google DeepMind Blog", url: "https://deepmind.google/blog/rss.xml", weight: 3, credibility: "official", aiOnly: true },
  { id: "google-ai-blog", kind: "rss", name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", weight: 3, credibility: "official", aiOnly: true },
  { id: "hf-blog", kind: "rss", name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", weight: 2, credibility: "official", aiOnly: true },
  { id: "nvidia-blog", kind: "rss", name: "NVIDIA Blog", url: "https://blogs.nvidia.com/feed/", weight: 2, credibility: "official", aiOnly: false },
  { id: "aws-ml-blog", kind: "rss", name: "AWS Machine Learning Blog", url: "https://aws.amazon.com/blogs/machine-learning/feed/", weight: 1.5, credibility: "official", aiOnly: true },
  { id: "github-changelog", kind: "rss", name: "GitHub Changelog", url: "https://github.blog/changelog/feed/", weight: 1.5, credibility: "official", aiOnly: false },
  { id: "qwen-blog", kind: "rss", name: "Qwen Blog", url: "https://qwenlm.github.io/blog/index.xml", weight: 3, credibility: "official", aiOnly: true }, // verify

  // Media and analysts
  { id: "verge-ai", kind: "rss", name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", weight: 1.5, credibility: "media", aiOnly: true },
  { id: "techcrunch-ai", kind: "rss", name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", weight: 1.5, credibility: "media", aiOnly: true },
  { id: "simonw", kind: "rss", name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", weight: 2, credibility: "media", aiOnly: false },

  // Community
  { id: "hn", kind: "hn", name: "Hacker News", weight: 2, credibility: "media", aiOnly: false },
  { id: "r-localllama", kind: "reddit", name: "r/LocalLLaMA", url: "LocalLLaMA", weight: 2, credibility: "media", aiOnly: true },
  { id: "r-machinelearning", kind: "reddit", name: "r/MachineLearning", url: "MachineLearning", weight: 1.5, credibility: "media", aiOnly: true },
  { id: "r-openai", kind: "reddit", name: "r/OpenAI", url: "OpenAI", weight: 1, credibility: "media", aiOnly: true },
  { id: "r-claudeai", kind: "reddit", name: "r/ClaudeAI", url: "ClaudeAI", weight: 1, credibility: "media", aiOnly: true },
  { id: "r-stablediffusion", kind: "reddit", name: "r/StableDiffusion", url: "StableDiffusion", weight: 1, credibility: "media", aiOnly: true },

  // Models and code
  { id: "hf-trending", kind: "huggingface", name: "Hugging Face Trending", weight: 2, credibility: "official", aiOnly: true },
  { id: "hf-papers", kind: "hf_papers", name: "Hugging Face Daily Papers (arXiv)", weight: 1, credibility: "media", aiOnly: true },
  { id: "gh-trending", kind: "github_trending", name: "GitHub Trending", weight: 1.5, credibility: "media", aiOnly: false },
  { id: "openrouter", kind: "openrouter", name: "OpenRouter Models", weight: 2, credibility: "official", aiOnly: true },

  // Pages without feeds, diffed every run (first fetch only records them). All "verify" until the first real run.
  { id: "watch-anthropic-news", kind: "page_watch", name: "Anthropic News", url: "https://www.anthropic.com/news", weight: 3, credibility: "official", aiOnly: true },
  { id: "watch-anthropic-pricing", kind: "page_watch", name: "Anthropic API pricing", url: "https://www.anthropic.com/pricing", weight: 2, credibility: "official", aiOnly: true },
  { id: "watch-openai-pricing", kind: "page_watch", name: "OpenAI API pricing", url: "https://openai.com/api/pricing/", weight: 2, credibility: "official", aiOnly: true },
  { id: "watch-gemini-pricing", kind: "page_watch", name: "Gemini API pricing", url: "https://ai.google.dev/gemini-api/docs/pricing", weight: 2, credibility: "official", aiOnly: true },
  { id: "watch-gemini-changelog", kind: "page_watch", name: "Gemini API changelog", url: "https://ai.google.dev/gemini-api/docs/changelog", weight: 2, credibility: "official", aiOnly: true },
  { id: "watch-meta-ai-blog", kind: "page_watch", name: "Meta AI Blog", url: "https://ai.meta.com/blog/", weight: 3, credibility: "official", aiOnly: true },
  { id: "watch-mistral-news", kind: "page_watch", name: "Mistral AI News", url: "https://mistral.ai/news", weight: 2, credibility: "official", aiOnly: true },
  { id: "watch-xai-news", kind: "page_watch", name: "xAI News", url: "https://x.ai/news", weight: 2, credibility: "official", aiOnly: true },
  { id: "watch-deepseek-news", kind: "page_watch", name: "DeepSeek API News", url: "https://api-docs.deepseek.com/updates", weight: 3, credibility: "official", aiOnly: true },
  { id: "watch-deepseek-pricing", kind: "page_watch", name: "DeepSeek API pricing", url: "https://api-docs.deepseek.com/quick_start/pricing", weight: 2, credibility: "official", aiOnly: true },

  // Launches
  { id: "producthunt", kind: "producthunt", name: "Product Hunt", url: "https://www.producthunt.com/feed", weight: 1, credibility: "media", aiOnly: false },

  // Pushed in: Grok bot (X), admin submissions
  { id: "inbox", kind: "inbox", name: "Inbox (Grok / manual)", weight: 2, credibility: "media", aiOnly: true },

  // Chinese platforms via self-hosted RSSHub (https://docs.rsshub.app). Disabled until RSSHUB_URL is set.
  // Check each route against the deployed instance's docs; RSSHub routes change between versions.
  // Weibo and Xiaohongshu routes need a logged-in cookie configured in RSSHub (WEIBO_COOKIES, XIAOHONGSHU_COOKIE).
  ...rsshub([
    { id: "zhihu-hot", name: "知乎热榜", route: "/zhihu/hot", aiOnly: false },
    // Per-account routes, filled from config/accounts.md (Chinese section) once RSSHub is up:
    // { id: "weibo-<name>", name: "微博 · <name>", route: "/weibo/user/<uid>", aiOnly: false },
    // { id: "jike-<name>", name: "即刻 · <name>", route: "/jike/user/<id>", aiOnly: false },
    // { id: "zhihu-<name>", name: "知乎 · <name>", route: "/zhihu/people/activities/<id>", aiOnly: false },
  ]),
];

function rsshub(routes: { id: string; name: string; route: string; aiOnly: boolean }[]): SourceConfig[] {
  return routes.map((r) => ({
    id: r.id,
    kind: "rss",
    name: r.name,
    url: `${RSSHUB}${r.route}`,
    weight: 1,
    credibility: "media",
    aiOnly: r.aiOnly,
    lang: "zh",
    enabled: !!RSSHUB,
  }));
}
