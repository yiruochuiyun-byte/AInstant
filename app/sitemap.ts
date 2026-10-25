import type { MetadataRoute } from "next";
import { getDb } from "../lib/db.ts";
import { LANGS, SITE_URL } from "../config/site.ts";
import { VISIBLE } from "../lib/queries.ts";
import { CATEGORIES } from "../lib/types.ts";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const events = await db.query<{ slug: string; updated_at: Date }>(
    `select slug, updated_at from events where ${VISIBLE} and slug is not null order by updated_at desc limit 5000`,
  );
  const entry = (path: string, lastModified?: Date) => ({
    url: `${SITE_URL}/en${path}`,
    lastModified,
    alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}${path}`])) },
  });
  return [entry(""), entry("/latest"), entry("/prices"), ...CATEGORIES.map((c) => entry(`/t/${c}`)), ...events.map((e) => entry(`/e/${e.slug}`, e.updated_at))];
}
