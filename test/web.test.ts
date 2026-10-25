import { test } from "node:test";
import assert from "node:assert/strict";
import { localClock, renderDigest } from "../pipeline/digest.ts";
import { timeAgo } from "../lib/i18n.ts";

test("localClock picks the subscriber's local hour and date", () => {
  const now = new Date("2026-10-25T00:30:00Z");
  assert.deepEqual(localClock("Asia/Shanghai", now), { hour: 8, date: "2026-10-25" });
  assert.deepEqual(localClock("America/Los_Angeles", now), { hour: 17, date: "2026-10-24" });
  assert.deepEqual(localClock("Europe/Berlin", new Date("2026-10-25T06:30:00Z")), { hour: 7, date: "2026-10-25" });
});

test("timeAgo in both languages", () => {
  const now = Date.parse("2026-10-25T06:00:00Z");
  assert.equal(timeAgo("2026-10-25T05:48:00Z", "en", now), "12 minutes ago");
  assert.equal(timeAgo("2026-10-25T03:00:00Z", "zh", now), "3 小时前");
  assert.equal(timeAgo("2026-10-25T06:00:00Z", "zh", now), "刚刚");
});

test("digest marks sponsors and escapes titles", () => {
  const e = { id: 1, slug: "a-1", title: "<b>X</b> ships", why: "Because", category: "models", item_type: "launch", tags: [], credibility: "official", hotness: 1, source_count: 3, item_count: 3, last_item_at: new Date(), has_controversy: false };
  const m = renderDigest("en", [e], { title: "Try Foo", body: null, url: "https://foo.dev" }, "https://x/unsub");
  assert.match(m.html, /&lt;b&gt;X&lt;\/b&gt; ships/);
  assert.match(m.html, /Sponsored/);
  assert.match(m.text, /Unsubscribe: https:\/\/x\/unsub/);
});
