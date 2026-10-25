"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dict } from "../lib/i18n.ts";
import type { Lang } from "../config/site.ts";

const KEY = "ainstant-lang-banner-dismissed";

/** First visit: if the browser prefers another edition we publish, offer it. Never redirects. */
export function LangBanner({ lang, langs }: { lang: Lang; langs: Lang[] }) {
  const path = usePathname() ?? "";
  const [suggest, setSuggest] = useState<Lang | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {}
    const preferred = navigator.languages.map((l) => l.slice(0, 2).toLowerCase()).find((l) => langs.includes(l as Lang)) as Lang | undefined;
    if (preferred && preferred !== lang) setSuggest(preferred);
  }, [lang, langs]);

  if (!suggest) return null;
  const t = dict(suggest);
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setSuggest(null);
  };
  return (
    <div className="banner" role="region" aria-label="language">
      <div className="wrap">
        <span>{t.switchTo}</span>
        <a href={path.replace(/^\/[a-z]{2}(?=\/|$)/, `/${suggest}`)} hrefLang={suggest} onClick={dismiss}>
          {t.switchAction}
        </a>
        <button onClick={dismiss}>{t.dismiss}</button>
      </div>
    </div>
  );
}
