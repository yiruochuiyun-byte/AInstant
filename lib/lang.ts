import { notFound } from "next/navigation";
import { LANGS, SITE_URL, type Lang } from "../config/site.ts";

export function asLang(value: string): Lang {
  if (!(LANGS as readonly string[]).includes(value)) notFound();
  return value as Lang;
}

/** hreflang alternates for a path that exists in every language, e.g. "/e/some-slug". */
export function alternates(lang: Lang, path = "") {
  return {
    canonical: `${SITE_URL}/${lang}${path}`,
    languages: {
      ...Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}${path}`])),
      "x-default": `${SITE_URL}/en${path}`,
    },
    types: { "application/rss+xml": `${SITE_URL}/${lang}/rss.xml` },
  };
}
