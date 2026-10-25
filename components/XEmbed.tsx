"use client";
import { useEffect, useState } from "react";
import { dict } from "../lib/i18n.ts";
import type { Lang } from "../config/site.ts";

const KEY = "ainstant-consent-x";

/**
 * X posts use X's official embed, which loads X's script and cookies, so it needs consent (GDPR).
 * Until then, a placeholder with a plain link. The choice is remembered on this device.
 */
export function XEmbed({ url, lang }: { url: string; lang: Lang }) {
  const t = dict(lang);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    try {
      setOk(localStorage.getItem(KEY) === "yes");
    } catch {}
  }, []);

  useEffect(() => {
    if (!ok) return;
    const w = window as unknown as { twttr?: { widgets: { load: () => void } } };
    if (w.twttr) return w.twttr.widgets.load();
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    document.body.appendChild(s);
  }, [ok]);

  if (ok) {
    return (
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={url.replace("https://x.com", "https://twitter.com")}>{url}</a>
      </blockquote>
    );
  }
  return (
    <div className="embed-ph">
      {t.embedPlaceholder}{" "}
      <button
        className="secondary"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "yes");
          } catch {}
          setOk(true);
        }}
      >
        {t.embedLoad}
      </button>{" "}
      <a href={url} target="_blank" rel="noopener">
        {t.embedOpen}
      </a>
    </div>
  );
}
