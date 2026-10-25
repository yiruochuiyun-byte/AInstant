import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLang, alternates } from "../../../../lib/lang.ts";
import { dict } from "../../../../lib/i18n.ts";
import { getDailyCounts, getHeadlines, getIncidents, getModels, getPrices } from "../../../../lib/queries.ts";
import { CATEGORIES } from "../../../../lib/types.ts";
import { EventCard } from "../../../../components/EventCard.tsx";
import { ModelDots } from "../../../../components/charts/ModelDots.tsx";
import { DailyBars, IncidentStrip, PriceChanges } from "../../../../components/charts/Mini.tsx";

export const revalidate = 60;

const asCategory = (c: string) => ((CATEGORIES as readonly string[]).includes(c) ? c : notFound());

export async function generateMetadata({ params }: PageProps<"/[lang]/t/[category]">): Promise<Metadata> {
  const { lang: l, category } = await params;
  const lang = asLang(l);
  return { title: dict(lang).labels[asCategory(category)], alternates: alternates(lang, `/t/${category}`) };
}

export default async function Topic({ params }: PageProps<"/[lang]/t/[category]">) {
  const { lang: l, category } = await params;
  const lang = asLang(l);
  const c = asCategory(category);
  const t = dict(lang);
  const now = Date.now();
  const [events, counts] = await Promise.all([getHeadlines(lang, { category: c, sinceHours: 24 * 14, limit: 60 }), getDailyCounts(14)]);
  events.sort((a, b) => new Date(b.last_item_at).getTime() - new Date(a.last_item_at).getTime());

  let chart: React.ReactNode = counts[c] ? <DailyBars lang={lang} counts={counts[c]} label={t.labels[c]} /> : null;
  if (c === "models") chart = <ModelDots lang={lang} models={await getModels()} now={now} />;
  if (c === "safety_incident") chart = <IncidentStrip lang={lang} items={await getIncidents(lang, 30)} now={now} />;
  if (c === "platforms_infra") chart = <PriceChanges lang={lang} rows={await getPrices()} />;

  return (
    <>
      <h1 className="event">{t.labels[c]}</h1>
      <p className="tagline">{t.topicIntro}</p>
      <div className="topic-chart">{chart}</div>
      {events.length === 0 && <p className="card">{t.noEvents}</p>}
      {events.map((e) => (
        <EventCard key={e.id} lang={lang} e={e} />
      ))}
    </>
  );
}
