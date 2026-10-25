import Link from "next/link";
import type { ReactNode } from "react";
import type { TopicNews } from "../lib/queries.ts";
import type { Lang } from "../config/site.ts";
import { dict, timeAgo } from "../lib/i18n.ts";

/** A story counts as new for this long after we first saw it. */
export const NEW_HOURS = 6;

export function NewsList({ lang, items, now = Date.now() }: { lang: Lang; items: TopicNews[]; now?: number }) {
  const t = dict(lang);
  if (!items.length) return <p className="fine">{t.noEvents}</p>;
  return (
    <ol className="news">
      {items.map((e) => {
        const fresh = now - new Date(e.first_seen_at).getTime() < NEW_HOURS * 3600_000;
        return (
          <li key={e.id}>
            <Link href={`/${lang}/e/${e.slug}`}>{e.title}</Link>
            <span className="meta">
              {fresh && <span className="badge-new">{t.newBadge}</span>}
              {e.has_controversy && <span className="chip disputed">{t.labels.criticism}</span>}
              <time dateTime={new Date(e.last_item_at).toISOString()}>{timeAgo(e.last_item_at, lang, now)}</time>
              <span>{t.sources(e.source_count)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function TopicCard({ lang, title, href, chart, children, wide }: { lang: Lang; title: string; href: string; chart?: ReactNode; children?: ReactNode; wide?: boolean }) {
  const t = dict(lang);
  return (
    <section className={wide ? "topic wide" : "topic"}>
      <header>
        <h2>
          <Link href={href}>{title}</Link>
        </h2>
        <Link href={href} className="more">
          {t.more} →
        </Link>
      </header>
      {chart}
      {children}
    </section>
  );
}
