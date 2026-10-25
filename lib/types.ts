export type Credibility = "official" | "media" | "rumor";

export type SourceKind =
  | "rss"
  | "hn"
  | "reddit"
  | "huggingface"
  | "hf_papers"
  | "github_trending"
  | "openrouter"
  | "inbox"
  | "page_watch"
  | "producthunt";

export interface SourceConfig {
  id: string;
  kind: SourceKind;
  name: string;
  /** Feed URL, subreddit name, etc. Meaning depends on kind. */
  url?: string;
  weight: number;
  credibility: Credibility;
  /** Source only publishes AI content, so skip the keyword prefilter. */
  aiOnly: boolean;
  lang?: string;
  enabled?: boolean;
}

/** What every source adapter returns. */
export interface RawItem {
  sourceId: string;
  /** The thing being talked about (article, repo, model page). */
  url: string;
  title: string;
  excerpt?: string;
  author?: string;
  publishedAt?: Date;
  engagement?: number;
  lang?: string;
  /** Where the discussion happened, when different from url (HN thread, Reddit post). */
  discussionUrl?: string;
  /** Overrides the URL for dedupe, when one URL can carry several stories (e.g. a model page and its price cut). */
  dedupeKey?: string;
}

export const CATEGORIES = [
  "models",
  "tools_apps",
  "platforms_infra",
  "open_source",
  "safety_incident",
  "industry_applications",
  "benchmarks",
] as const;

export const ITEM_TYPES = ["launch", "upgrade", "price_cut", "progress", "incident"] as const;

export const NODE_TYPES = [
  "announcement",
  "early_test",
  "criticism",
  "official_response",
  "follow_up",
] as const;

export const CLAIM_TYPES = ["fact", "allegation", "opinion"] as const;

export const REJECT_REASONS = ["none", "not_ai", "funding", "policy", "low_signal"] as const;
