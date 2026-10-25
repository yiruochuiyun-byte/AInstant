import type { Metadata } from "next";
import { asLang, alternates } from "../../lib/lang.ts";
import { dict } from "../../lib/i18n.ts";
import { getDailyCounts, getIncidents, getModels, getPrices, getRisingTags, getSponsor, getTopicNews } from "../../lib/queries.ts";
import { TopicCard, NewsList } from "../../components/TopicCard.tsx";
import { ModelDots } from "../../components/charts/ModelDots.tsx";
import { DailyBars, IncidentStrip, PriceChanges, RisingTags, TrendRows } from "../../components/charts/Mini.tsx";
import { Sponsored } from "../../components/Sponsored.tsx";
import type { Lang } from "../../config/site.ts";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { alternates: alternates(lang) };
}

// Sections after "models", in page order, and the chart each one gets.
const SECTIONS = ["tools_apps", "platforms_infra", "open_source", "safety_incident", "industry_applications", "benchmarks"] as const;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const lang = asLang((await params).lang);
  const t = dict(lang);
  const now = Date.now();
  const [models, modelNews, counts, tags, incidents, prices, sponsor, ...news] = await Promise.all([
    getModels(),
    getTopicNews(lang, "models", 8),
    getDailyCounts(14),
    getRisingTags(8),
    getIncidents(lang, 30),
    getPrices(),
    getSponsor(lang, "home"),
    ...SECTIONS.map((c) => getTopicNews(lang, c, 5)),
  ]);

  const chartFor = (c: (typeof SECTIONS)[number]) => {
    if (c === "safety_incident") return <IncidentStrip lang={lang} items={incidents} now={now} />;
    const bars = counts[c] ? <DailyBars lang={lang} counts={counts[c]} label={t.labels[c]} /> : null;
    if (c === "platforms_infra") return <>{bars}<PriceChanges lang={lang} rows={prices} /></>;
    return bars;
  };

  return (
    <div className="home">
      <p className="tagline">{t.tagline}</p>
      <div className="topics">
        <TopicCard lang={lang} title={t.labels.models} href={`/${lang}/t/models`} wide chart={<ModelDots lang={lang} models={models} now={now} />}>
          <NewsList lang={lang} items={modelNews} now={now} />
        </TopicCard>
        <TopicCard lang={lang} title={t.trends} href={`/${lang}/latest`} chart={<TrendRows lang={lang} counts={counts} />}>
          <RisingTags lang={lang} tags={tags} />
        </TopicCard>
        {SECTIONS.map((c, i) => (
          <Section key={c} lang={lang} c={c} chart={chartFor(c)} items={news[i]} now={now} />
        ))}
      </div>
      {sponsor && <Sponsored lang={lang} s={sponsor} />}
    </div>
  );
}

function Section({ lang, c, chart, items, now }: { lang: Lang; c: string; chart: React.ReactNode; items: Awaited<ReturnType<typeof getTopicNews>>; now: number }) {
  const t = dict(lang);
  return (
    <TopicCard lang={lang} title={t.labels[c]} href={`/${lang}/t/${c}`} chart={chart}>
      <NewsList lang={lang} items={items} now={now} />
    </TopicCard>
  );
}
