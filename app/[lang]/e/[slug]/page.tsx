import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLang, alternates } from "../../../../lib/lang.ts";
import { dict, timeAgo } from "../../../../lib/i18n.ts";
import { getEvent } from "../../../../lib/queries.ts";
import { Labels } from "../../../../components/EventCard.tsx";
import { XEmbed } from "../../../../components/XEmbed.tsx";
import { entitySlug } from "../../../../lib/entities.ts";
import Link from "next/link";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/[lang]/e/[slug]">): Promise<Metadata> {
  const p = await params;
  const lang = asLang(p.lang);
  const ev = await getEvent(lang, p.slug);
  if (!ev) return {};
  return { title: ev.title, description: ev.why ?? undefined, alternates: alternates(lang, `/e/${ev.slug}`) };
}

export default async function EventPage({ params }: PageProps<"/[lang]/e/[slug]">) {
  const p = await params;
  const lang = asLang(p.lang);
  const ev = await getEvent(lang, p.slug);
  if (!ev) notFound();
  const t = dict(lang);
  const fmt = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  return (
    <article>
      <h1 className="event">{ev.title}</h1>
      <div className="meta">
        <Labels lang={lang} e={ev} />
        <span>{t.sources(ev.source_count)}</span>
        <time dateTime={new Date(ev.last_item_at).toISOString()}>{t.updated(timeAgo(ev.last_item_at, lang))}</time>
      </div>
      {ev.entities.length > 0 && (
        <p className="tags event-topics">
          <span className="meta-inline">{t.topicsIn}:</span>
          {[...new Map(ev.entities.map((n) => [entitySlug(n), n])).entries()].filter(([s]) => s).map(([s, n]) => (
            <Link key={s} className="chip" href={`/${lang}/x/${s}`}>{n}</Link>
          ))}
        </p>
      )}
      {ev.why && (
        <p className="why">
          <strong>{t.why}:</strong> {ev.why}
        </p>
      )}
      {ev.has_controversy && <p className="note">{t.neutralNote}</p>}

      <h2>{t.timeline}</h2>
      <ol className="timeline">
        {ev.items.map((i) => (
          <li key={i.id} className={i.node_type}>
            <div className="tl-head">
              <time dateTime={new Date(i.at).toISOString()}>{fmt.format(new Date(i.at))} UTC</time>
              <span className="chip">{t.labels[i.node_type]}</span>
              <span className={`chip claim-${i.claim_type}`}>{t.labels[i.claim_type]}</span>
              <span className={`chip cred-${i.credibility}`}>{t.labels[i.credibility]}</span>
              <span>{i.source_name}{i.author ? ` · @${i.author}` : ""}</span>
            </div>
            <p className="tl-body">
              {i.summary}{" "}
              <a href={i.url} target="_blank" rel="noopener">{t.original} ↗</a>
            </p>
            {/^https:\/\/(x|twitter)\.com\/[^/]+\/status\//.test(i.url) && <XEmbed url={i.url} lang={lang} />}
          </li>
        ))}
      </ol>

      {ev.discussions.length > 0 && (
        <p className="meta">
          {ev.discussions.map((d) => (
            <a key={d.discussion_url} href={d.discussion_url} target="_blank" rel="noopener">
              {d.source_name} ({d.engagement})
            </a>
          ))}
        </p>
      )}

      {ev.corrections.length > 0 && (
        <section>
          <h2>{t.corrections}</h2>
          <ul>
            {ev.corrections.map((c, n) => (
              <li key={n} className="meta">
                {fmt.format(new Date(c.created_at))}: {c.field} “{c.old_value}” → “{c.new_value}”{c.reason ? ` (${c.reason})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
