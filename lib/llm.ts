import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { CATEGORIES, CLAIM_TYPES, ITEM_TYPES, NODE_TYPES, REJECT_REASONS } from "./types.ts";

// Bulk work (classification, clustering checks, event headlines) runs on the cheapest fast model.
export const MODEL = process.env.AINSTANT_MODEL ?? "claude-haiku-5-5";

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

async function ask<T extends z.ZodType>(system: string, user: string, schema: T): Promise<z.infer<T>> {
  const res = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: zodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal") throw new Error("model refused");
  if (!res.parsed_output) throw new Error(`no parsed output (stop_reason=${res.stop_reason})`);
  return res.parsed_output;
}

// ---------- 1. Classify one item ----------

export const Classification = z.object({
  relevant: z.boolean(),
  reject_reason: z.enum(REJECT_REASONS),
  category: z.enum(CATEGORIES),
  item_type: z.enum(ITEM_TYPES),
  tags: z.array(z.string()).describe("1-4 lowercase domain tags, e.g. speech, coding, video, agents, robotics"),
  node_type: z.enum(NODE_TYPES),
  claim_type: z.enum(CLAIM_TYPES),
  summary_en: z.string(),
  entities: z.array(z.string()),
});
export type Classification = z.infer<typeof Classification>;

export interface ClassifyInput {
  source: string;
  credibility: string;
  title: string;
  excerpt?: string | null;
  url: string;
  lang?: string | null;
}

const CLASSIFY_SYSTEM = `You are the filter desk of AInstant, an English-language aggregator of AI news (a Techmeme for AI).
Decide whether one incoming item belongs on the site and label it.

Include anything the AI community is actively discussing: model releases and updates, tools and apps, platforms and infrastructure (Hugging Face, GitHub, inference providers), open source, safety incidents, industry applications, benchmarks and evals, and disputes around any of these.
Set relevant=false with a reject_reason when the item is:
- funding: funding rounds, valuations, acquisitions, earnings
- policy: government policy, regulation, lawsuits about policy
- not_ai: not about AI
- low_signal: tutorials, listicles, questions or help requests, memes, self-promotion with no news
When relevant=true, reject_reason is "none". Fill every other field either way.

Labels:
- category: models | tools_apps | platforms_infra | open_source | safety_incident | industry_applications | benchmarks
- item_type: launch (new thing) | upgrade (new version or feature) | price_cut | progress (research result, milestone) | incident (outage, leak, controversy, safety problem)
- node_type, the item's role in a story: announcement (first-party release) | early_test (hands-on results, first benchmarks) | criticism (doubts, accusations, complaints) | official_response (the company answers criticism) | follow_up (later developments)
- claim_type: fact (verifiable, e.g. a release happened) | allegation (someone accuses someone) | opinion (judgement, review)

summary_en: one neutral English sentence of at most 30 words, written in your own words; never copy a sentence from the source. Translate if the source is not English. Attribute claims ("users report", "X says"). No hype or loaded words.
entities: names of companies, models and products, spelled exactly as their owners spell them (e.g. "DeepSeek", "Qwen3", "Claude Opus 5.5"). Never translate names.`;

export async function classify(input: ClassifyInput): Promise<Classification> {
  return ask(CLASSIFY_SYSTEM, JSON.stringify(input), Classification);
}

// ---------- 2. Is this item part of that event? ----------

const SameEvent = z.object({ same: z.boolean() });

export async function sameEvent(event: { title: string; entities: string[] }, item: { summary: string; entities: string[] }): Promise<boolean> {
  const system = `You group news items into stories. A story is one development and everything that follows from it: the announcement, hands-on tests, criticism, official responses, follow-ups.
Answer same=true only if the item is part of the given story, not merely about the same company or topic.`;
  const user = JSON.stringify({ story: event, item });
  return (await ask(system, user, SameEvent)).same;
}

// ---------- 3. Headline an event from its timeline ----------

export const EventSummary = z.object({
  title_en: z.string(),
  why_en: z.string(),
  category: z.enum(CATEGORIES),
  item_type: z.enum(ITEM_TYPES),
  tags: z.array(z.string()),
});
export type EventSummary = z.infer<typeof EventSummary>;

export interface TimelineEntry {
  at: string;
  source: string;
  credibility: string;
  node_type: string;
  claim_type: string;
  summary: string;
}

const EVENT_SYSTEM = `You write the headline for one AI news story on AInstant from its timeline of sources.
- title_en: a neutral, factual English headline of at most 90 characters. Lead with who did what. No clickbait, no loaded or emotional words, no question headlines.
- If the story contains criticism or allegations, attribute them ("X says", "users report", "researchers question") and never state an allegation as fact or pick a side.
- why_en: one sentence of at most 30 words on why the story matters to people who build with or follow AI.
- category, item_type: as for the story as a whole. tags: 1-4 lowercase domain tags.
Keep product, model and company names exactly as written.`;

export async function summarizeEvent(timeline: TimelineEntry[]): Promise<EventSummary> {
  return ask(EVENT_SYSTEM, JSON.stringify({ timeline }), EventSummary);
}

// ---------- 4. Translate a batch of short texts ----------

const Translations = z.object({ translations: z.array(z.object({ key: z.string(), text: z.string() })) });

export interface TranslateRequest {
  lang: string;
  glossary: { keep: string[]; terms: Record<string, string> };
  texts: { key: string; text: string }[];
}

const LANG_NAMES: Record<string, string> = { zh: "Simplified Chinese", de: "German" };

export async function translate(req: TranslateRequest): Promise<Record<string, string>> {
  const system = `You translate short AI news texts (headlines and one-sentence summaries) from English into ${LANG_NAMES[req.lang] ?? req.lang}.
- Keep every company, model and product name exactly as written in English; also keep the names in glossary.keep.
- Use glossary.terms for the listed terms.
- Keep the tone neutral and keep attributions ("X says", "users report", "alleges") so allegations are never stated as fact.
- Return one translation per input key.`;
  const out = await ask(system, JSON.stringify(req), Translations);
  return Object.fromEntries(out.translations.map((t) => [t.key, t.text]));
}

// ---------- 5. Weekly issue overview ----------

const WeeklyIntro = z.object({ intro_en: z.string() });

export interface WeeklyIntroInput {
  week: string;
  stories: { title: string; why: string | null; disputed: boolean }[];
  new_models: string[];
  rising_tags: string[];
}

const WEEKLY_SYSTEM = `You write the opening paragraph of AInstant Weekly, a neutral English roundup of the week in AI.
- intro_en: 2-3 sentences, at most 70 words, naming the week's biggest developments from the given stories.
- Only use facts in the input. If a story is disputed, say who claims what ("users report", "X says"); never state an allegation as fact.
- No hype, no loaded words, no predictions, no greeting. Keep product, model and company names exactly as written.`;

export async function weeklyIntro(input: WeeklyIntroInput): Promise<string> {
  return (await ask(WEEKLY_SYSTEM, JSON.stringify(input), WeeklyIntro)).intro_en;
}
