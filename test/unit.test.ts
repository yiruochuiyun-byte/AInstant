import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalUrl, urlHash } from "../lib/url.ts";
import { decide, sharesEntity } from "../pipeline/cluster.ts";
import { hotness } from "../pipeline/rank.ts";
import { slugify } from "../pipeline/events.ts";
import { parseFeed } from "../pipeline/sources/rss.ts";
import { parseTrending } from "../pipeline/sources/github.ts";
import type { SourceConfig } from "../lib/types.ts";

const cfg: SourceConfig = { id: "t", kind: "rss", name: "t", weight: 1, credibility: "media", aiOnly: true };

test("canonicalUrl folds tracking params, www, trailing slash, twitter.com", () => {
  assert.equal(canonicalUrl("http://www.lumenlabs.ai/blog/orca-s2s/?utm_source=reddit#top"), "https://lumenlabs.ai/blog/orca-s2s");
  assert.equal(canonicalUrl("https://twitter.com/a/status/1?s=20"), "https://x.com/a/status/1");
  assert.equal(canonicalUrl("https://arxiv.org/pdf/2510.01234v2"), "https://arxiv.org/abs/2510.01234");
  assert.equal(urlHash("https://a.com/x?b=2&a=1"), urlHash("https://a.com/x?a=1&b=2"));
  assert.notEqual(urlHash("https://a.com/x?id=1"), urlHash("https://a.com/x?id=2"));
});

test("decide: join on high similarity, ask the LLM only when a name is shared", () => {
  const t = { join: 0.86, check: 0.7 };
  assert.equal(decide(0.9, false, t), "join");
  assert.equal(decide(0.75, true, t), "check");
  assert.equal(decide(0.75, false, t), "new");
  assert.equal(decide(0.5, true, t), "new");
});

test("sharesEntity matches names and their variants", () => {
  assert.ok(sharesEntity(["Orca-S2S"], ["lumenlabs", "Orca-S2S-7B"]));
  assert.ok(sharesEntity(["Lumen Labs"], ["lumen labs"]));
  assert.ok(!sharesEntity(["Orca"], ["Orchid"]));
});

test("hotness: breadth beats volume, and decays with age", () => {
  const base = { engagement: 500, hoursSinceLast: 1, hoursSinceFirst: 2 };
  const oneBigSource = hotness({ ...base, sourceWeights: [2], platforms: 1 });
  const manySources = hotness({ ...base, sourceWeights: [2, 2, 3], platforms: 3 });
  assert.ok(manySources > 3 * oneBigSource);
  const later = hotness({ ...base, sourceWeights: [2, 2, 3], platforms: 3, hoursSinceLast: 19, hoursSinceFirst: 20 });
  assert.ok(later < manySources / 1.9);
});

test("slugify keeps ids stable and ascii", () => {
  assert.equal(slugify("Lumen Labs' Orca-S2S: 180 ms!", 7), "lumen-labs-orca-s2s-180-ms-7");
  assert.equal(slugify("发布", 3), "event-3");
});

test("parseFeed reads RSS and Atom", () => {
  const rss = `<rss><channel><item><title>A</title><link>https://a.com/1</link><pubDate>Fri, 24 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Hi&lt;/p&gt;</description></item></channel></rss>`;
  const [r] = parseFeed(rss, cfg);
  assert.equal(r.url, "https://a.com/1");
  assert.equal(r.excerpt, "Hi");
  const atom = `<feed><entry><title>B</title><link rel="alternate" href="https://b.com/2"/><published>2026-10-24T10:00:00Z</published></entry></feed>`;
  assert.equal(parseFeed(atom, cfg)[0].url, "https://b.com/2");
});

test("parseTrending extracts repo, description and stars today", () => {
  const html = `<article class="Box-row"><h2 class="h3 lh-condensed"><a href="/kestrel-ai/kestrel-coder" class="Link">x</a></h2>
    <p class="col-9 color-fg-muted my-1 pr-4">Open coding model</p><span>1,234 stars today</span></article>`;
  const [r] = parseTrending(html, cfg);
  assert.equal(r.url, "https://github.com/kestrel-ai/kestrel-coder");
  assert.equal(r.engagement, 1234);
  assert.match(r.title, /Open coding model/);
});

test("page watch: text extraction and added lines ignore markup and noise", async () => {
  const { pageText, addedLines } = await import("../pipeline/sources/pagewatch.ts");
  const before = pageText(`<html><head><title>x</title></head><body><script>var a=1</script><h2>Claude Opus 5.5</h2><p>Input $5 / MTok</p><p>© 2026 Anthropic</p></body></html>`);
  const after = pageText(`<body><h2>Claude Opus 5.5</h2><p>Input $4 / MTok</p><p>© 2027 Anthropic</p><p>Updated: 3 minutes ago</p></body>`);
  assert.equal(before, "Claude Opus 5.5\nInput $5 / MTok\n© 2026 Anthropic");
  assert.deepEqual(addedLines(before, after), ["Input $4 / MTok"]);
});

test("page watch: first fetch records, later changes become items", async () => {
  const { connect, migrate } = await import("../lib/db.ts");
  const { syncSources } = await import("../pipeline/ingest.ts");
  const { fetchPageWatch } = await import("../pipeline/sources/pagewatch.ts");
  const db = await connect({ memory: true });
  await migrate(db);
  const src = { id: "watch-x", kind: "page_watch" as const, name: "X pricing", url: "https://x.dev/pricing", weight: 2, credibility: "official" as const, aiOnly: true };
  await syncSources(db, [src]);
  assert.deepEqual(await fetchPageWatch(src, db, "<p>Model A $5</p>"), []);
  assert.deepEqual(await fetchPageWatch(src, db, "<p>Model A $5</p>"), []);
  const [item] = await fetchPageWatch(src, db, "<p>Model A $5</p><p>Model B $1</p>");
  assert.equal(item.title, "X pricing changed: Model B $1");
  assert.match(item.dedupeKey!, /^https:\/\/x\.dev\/pricing#/);
  await db.close();
});

test("topic slugs merge spellings", async () => {
  const { entitySlug } = await import("../lib/entities.ts");
  assert.equal(entitySlug("Claude Opus 5.5"), "claude-opus-5-5");
  assert.equal(entitySlug("DeepMind"), "google-deepmind");
  assert.equal(entitySlug("Google DeepMind"), "google-deepmind");
  assert.equal(entitySlug("智谱"), "zhipu");
  assert.equal(entitySlug("Z.ai"), "zhipu");
  assert.equal(entitySlug("某公司"), "");
});
