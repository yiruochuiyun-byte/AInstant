// Languages the site is published in. English is the original; others are translations.
// Adding "de": add it here, add its UI strings in lib/i18n.ts, and the pipeline starts translating.
export const LANGS = ["en", "zh"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

export const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "AInstant";

/** Languages whose summaries must stay extra short (EU press-publisher right, strictest in Germany). */
export const SHORT_EXCERPT_LANGS: string[] = ["de"];
