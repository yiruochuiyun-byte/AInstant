import Link from "next/link";
import type { EventCard as Card } from "../lib/queries.ts";
import { dict, timeAgo } from "../lib/i18n.ts";
import type { Lang } from "../config/site.ts";

export function Labels({ lang, e }: { lang: Lang; e: Pick<Card, "category" | "item_type" | "credibility" | "has_controversy" | "tags"> }) {
  const t = dict(lang);
  return (
    <>
      {e.category && <span className="chip">{t.labels[e.category] ?? e.category}</span>}
      {e.item_type && <span className="chip">{t.labels[e.item_type] ?? e.item_type}</span>}
      {e.credibility && <span className={`chip cred-${e.credibility}`}>{t.labels[e.credibility]}</span>}
      {e.has_controversy && <span className="chip disputed">{t.labels.criticism}</span>}
      {e.tags.map((tag) => (
        <Link key={tag} className="chip" href={`/${lang}/latest?tag=${encodeURIComponent(tag)}`}>
          #{tag}
        </Link>
      ))}
    </>
  );
}

export function EventCard({ lang, e }: { lang: Lang; e: Card }) {
  const t = dict(lang);
  return (
    <article className="card">
      <h2>
        <Link href={`/${lang}/e/${e.slug}`}>{e.title}</Link>
      </h2>
      {e.why && <p className="why">{e.why}</p>}
      <div className="meta">
        <Labels lang={lang} e={e} />
        <span>{t.sources(e.source_count)}</span>
        <time dateTime={new Date(e.last_item_at).toISOString()}>{t.updated(timeAgo(e.last_item_at, lang))}</time>
      </div>
    </article>
  );
}
