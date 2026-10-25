import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asLang, alternates } from "../../../../lib/lang.ts";
import { dict } from "../../../../lib/i18n.ts";
import { entityIndex, MIN_STORIES } from "../../../../lib/entities.ts";
import { getEventsById, getModels, getPrices } from "../../../../lib/queries.ts";
import { normName } from "../../../../pipeline/models.ts";
import { EventCard } from "../../../../components/EventCard.tsx";
import { WeekBars } from "../../../../components/charts/Mini.tsx";
import { isoWeek } from "../../../../lib/week.ts";

export const revalidate = 300;

async function load(slug: string) {
  return (await entityIndex()).get(slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/x/[slug]">): Promise<Metadata> {
  const { lang: l, slug } = await params;
  const lang = asLang(l);
  const e = await load(slug);
  if (!e) return {};
  return {
    title: e.name,
    description: dict(lang).topicsIntro,
    alternates: alternates(lang, `/x/${slug}`),
    // Thin pages stay out of search until they have a few stories.
    robots: e.stories.length < MIN_STORIES ? { index: false } : undefined,
  };
}

export default async function Topic({ params }: PageProps<"/[lang]/x/[slug]">) {
  const { lang: l, slug } = await params;
  const lang = asLang(l);
  const e = await load(slug);
  if (!e) notFound();
  const t = dict(lang);
  const fmt = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeZone: "UTC" });

  const [events, models, prices] = await Promise.all([getEventsById(lang, e.stories.slice(0, 60).map((s) => s.id)), getModels(), getPrices()]);
  const key = normName(e.name);
  const model = models.find((m) => normName(m.name) === key);
  const price = prices.find((p) => normName(p.name.replace(/^[^:]+:\s*/, "")) === key);

  // Stories per ISO week, last 12 weeks.
  const thisWeek = isoWeek(new Date()).start.getTime();
  const weeks = new Array(12).fill(0);
  for (const s of e.stories) {
    const back = Math.floor((thisWeek - isoWeek(new Date(s.first_seen_at)).start.getTime()) / (7 * 864e5));
    if (back >= 0 && back < 12) weeks[11 - back]++;
  }
  const types = new Map<string, number>();
  for (const s of e.stories) if (s.item_type) types.set(s.item_type, (types.get(s.item_type) ?? 0) + 1);
  const disputed = e.stories.filter((s) => s.has_controversy).length;
  const first = e.stories[e.stories.length - 1].first_seen_at;
  const panel = model && (model.modality === "language" ? "language" : model.modality);

  return (
    <>
      <h1 className="event">{e.name}</h1>
      <div className="meta">
        <span>{t.topicStories(e.stories.length, fmt.format(new Date(first)))}</span>
        {[...types].sort((a, b) => b[1] - a[1]).map(([k, n]) => (
          <span key={k} className="chip">{t.labels[k] ?? k} {n}</span>
        ))}
        {disputed > 0 && <span className="chip disputed">{t.disputedCount(disputed)}</span>}
      </div>

      <div className="topic-head">
        <WeekBars lang={lang} counts={weeks} />
        {(model || price) && (
          <dl className="facts">
            {model && panel && (
              <>
                <dt>{t.leaderboard}</dt>
                <dd>
                  {t.modelPanels[panel]} · {t.modelScore[panel]} <b>{Math.round(model.score!)}</b>
                  {model.agentic_score != null && <> · {t.modelScore.agents} <b>{Math.round(model.agentic_score)}</b></>}
                  {model.released_on && <> · {t.releasedOn(model.released_on)}</>}
                </dd>
              </>
            )}
            {price && (
              <>
                <dt>
                  <Link href={`/${lang}/prices`}>{t.prices}</Link>
                </dt>
                <dd>{t.priceNow(String(price.prompt), String(price.completion))}</dd>
              </>
            )}
          </dl>
        )}
      </div>

      {e.related.length > 0 && (
        <p className="tags">
          <span className="meta-inline">{t.relatedTopics}:</span>
          {e.related.map((r) => (
            <Link key={r.slug} className="chip" href={`/${lang}/x/${r.slug}`}>
              {r.name}
            </Link>
          ))}
        </p>
      )}

      {events.map((ev) => (
        <EventCard key={ev.id} lang={lang} e={ev} />
      ))}
    </>
  );
}
