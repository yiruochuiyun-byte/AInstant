// Fills the local offline database with two weeks of made-up stories so the homepage charts have something to show.
// Every company, model and story here is fictional. Never run against production (refuses when DATABASE_URL is set).
import { connect, migrate } from "../lib/db.ts";
import { syncModels } from "../pipeline/models.ts";
import { slugify } from "../pipeline/events.ts";

if (process.env.DATABASE_URL) throw new Error("demo data is for local databases only");
process.env.AINSTANT_OFFLINE = "1";

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

const STORIES: Record<string, { titles: string[]; tags: string[]; type: string[] }> = {
  models: {
    titles: ["{c} releases {m} with longer context", "{m} tops a coding benchmark in early tests", "Users report {m} refuses more prompts after update", "{c} open-sources a small version of {m}"],
    tags: ["coding", "reasoning", "multimodal", "speech"],
    type: ["launch", "upgrade", "progress"],
  },
  tools_apps: {
    titles: ["{c} adds an agent mode to its desktop app", "New IDE plugin from {c} writes tests from diffs", "{c} launches a meeting notes app built on {m}"],
    tags: ["agents", "coding", "productivity"],
    type: ["launch", "upgrade"],
  },
  platforms_infra: {
    titles: ["{c} opens a new GPU region for inference", "Inference provider adds {m} at lower prices", "{c} API outage lasts two hours"],
    tags: ["inference", "gpu", "api"],
    type: ["launch", "price_cut", "incident"],
  },
  open_source: {
    titles: ["{m} weights trend on Hugging Face", "Open toolkit for fine-tuning {m} passes 10k GitHub stars", "{c} publishes training data recipe"],
    tags: ["weights", "fine-tuning", "datasets"],
    type: ["launch", "progress"],
  },
  safety_incident: {
    titles: ["Researchers show prompt injection in {c} browser agent", "{c} pulls a feature after data exposure reports", "Jailbreak for {m} spreads on forums"],
    tags: ["security", "privacy", "jailbreak"],
    type: ["incident"],
  },
  industry_applications: {
    titles: ["Hospital network pilots {m} for discharge notes", "Logistics firm uses {c} agents for customs forms", "Bank deploys {m} for internal search"],
    tags: ["healthcare", "finance", "agents"],
    type: ["progress"],
  },
  benchmarks: {
    titles: ["New agent benchmark puts {m} first", "Researchers question contamination in a popular coding eval", "Leaderboard adds a long-video track"],
    tags: ["evals", "coding", "agents"],
    type: ["progress"],
  },
};
const COMPANIES = ["Lumen Labs", "Acme AI", "Kestrel", "Northwind", "Halcyon", "Corvid Research", "Tessera", "Juniper Labs"];
const MODELS = ["Orca 5", "Kestrel-Coder 2", "Gale 3 Flash", "Halcyon 4", "Tess 2.5", "Juno 3"];
const WEIGHT = { models: 3, tools_apps: 2, platforms_infra: 1.4, open_source: 1.6, safety_incident: 0.6, industry_applications: 1, benchmarks: 0.8 };

const db = await connect();
await migrate(db);
const [{ n: existing }] = await db.query<{ n: number }>(`select count(*)::int as n from events where why_en = 'Demo story (fictional).'`);
if (existing) {
  console.log(`demo: already loaded (${existing} stories)`);
  await db.close();
  process.exit(0);
}
const now = Date.now();
let made = 0;

async function addEvent(cat: string, title: string, entities: string[], type: string, hoursAgo: number, tags: string[]) {
  const first = new Date(now - hoursAgo * 3600_000);
  const last = new Date(Math.min(now, first.getTime() + rnd() * 20 * 3600_000));
  const [e] = await db.query<{ id: number }>(
    `insert into events (title_en, why_en, category, item_type, tags, credibility, entities, hotness, status, has_controversy, item_count, source_count, first_seen_at, last_item_at)
     values ($1, $2, $3, $4, $5, 'media', $6, $7, 'auto', $8, $9, $9, $10, $11) returning id`,
    [title, "Demo story (fictional).", cat, type, tags, entities, rnd() * 10, /question|report|exposure|jailbreak/i.test(title), 1 + Math.floor(rnd() * 6), first, last],
  );
  await db.query(`update events set slug = $2 where id = $1`, [e.id, slugify(title, e.id)]);
  made++;
}

for (const [cat, s] of Object.entries(STORIES)) {
  const n = Math.round(WEIGHT[cat as keyof typeof WEIGHT] * 9);
  for (let i = 0; i < n; i++) {
    const c = pick(COMPANIES);
    const m = pick(MODELS);
    // More stories recently, so the trend bars rise.
    const hoursAgo = Math.pow(rnd(), 1.4) * 14 * 24;
    await addEvent(cat, pick(s.titles).replace("{c}", c).replace("{m}", m), [c, m], pick(s.type), hoursAgo, [pick(s.tags)]);
  }
}

// Launch stories for the image, video and voice models: the free leaderboards carry no release dates,
// so the pipeline dates those models from the day we first reported them.
await syncModels(db, new Date(), true);
const media = await db.query<{ name: string; creator: string }>(`select name, creator from models where released_on is null`);
for (const m of media) {
  const daysAgo = Math.pow(rnd(), 0.8) * 520;
  await addEvent("models", `${m.creator} releases ${m.name}`, [m.creator, m.name], "launch", daysAgo * 24 + 1, []);
}
await syncModels(db, new Date(), true);
console.log(`demo: ${made} fictional stories`);
await db.close();
