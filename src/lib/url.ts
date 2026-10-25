import { createHash } from "node:crypto";

const TRACKING_PARAMS = /^(utm_\w+|ref|ref_src|ref_url|source|s|t|si|fbclid|gclid|mc_cid|mc_eid|igshid|feature)$/i;

/** Normalize a URL so the same story from different places hashes the same. */
export function canonicalUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  u.protocol = "https:";
  u.hash = "";
  let host = u.hostname.toLowerCase().replace(/^(www|m|mobile|old)\./, "");
  if (host === "twitter.com" || host === "x.com" || host === "mobile.x.com") host = "x.com";
  if (host === "youtu.be") {
    u.searchParams.set("v", u.pathname.slice(1));
    u.pathname = "/watch";
    host = "youtube.com";
  }
  u.hostname = host;
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  u.searchParams.sort();
  let path = u.pathname.replace(/\/+$/, "");
  if (host === "arxiv.org") path = path.replace(/^\/pdf\//, "/abs/").replace(/v\d+$/, "").replace(/\.pdf$/, "");
  u.pathname = path || "/";
  return u.toString().replace(/\/$/, "");
}

export function urlHash(raw: string): string {
  return createHash("sha256").update(canonicalUrl(raw)).digest("hex").slice(0, 32);
}

export function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
