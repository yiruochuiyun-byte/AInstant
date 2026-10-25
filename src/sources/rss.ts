import { XMLParser } from "fast-xml-parser";
import type { RawItem, SourceConfig } from "../types.ts";
import { clip, fetchText } from "../lib/util.ts";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });
const arr = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const text = (x: unknown): string | undefined =>
  typeof x === "string" ? x : x && typeof x === "object" && "#text" in x ? String((x as { "#text": unknown })["#text"]) : undefined;

/** Parses RSS 2.0 and Atom. */
export function parseFeed(xml: string, cfg: SourceConfig): RawItem[] {
  const doc = parser.parse(xml);
  if (doc.rss) {
    return arr(doc.rss.channel?.item).map((it: Record<string, unknown>) => ({
      sourceId: cfg.id,
      url: text(it.link) ?? text(it.guid) ?? "",
      title: clip(text(it.title), 300) ?? "",
      excerpt: clip(text(it.description) ?? text(it["content:encoded"]), 500),
      author: text(it["dc:creator"]) ?? text(it.author),
      publishedAt: it.pubDate ? new Date(String(it.pubDate)) : undefined,
      lang: cfg.lang,
    }));
  }
  if (doc.feed) {
    return arr(doc.feed.entry).map((e: Record<string, unknown>) => {
      const links = arr(e.link as Record<string, string> | Record<string, string>[]);
      const link = links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0];
      return {
        sourceId: cfg.id,
        url: link?.["@href"] ?? "",
        title: clip(text(e.title), 300) ?? "",
        excerpt: clip(text(e.summary) ?? text(e.content), 500),
        author: text((e.author as Record<string, unknown> | undefined)?.name),
        publishedAt: e.published || e.updated ? new Date(String(e.published ?? e.updated)) : undefined,
        lang: cfg.lang,
      };
    });
  }
  throw new Error("not an RSS or Atom feed");
}

export async function fetchRss(cfg: SourceConfig): Promise<RawItem[]> {
  return parseFeed(await fetchText(cfg.url!), cfg).filter((i) => i.url && i.title);
}
