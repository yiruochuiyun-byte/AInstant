import type { Metadata } from "next";
import Link from "next/link";
import { asLang, alternates } from "../../../lib/lang.ts";
import { dict } from "../../../lib/i18n.ts";
import { listEntities } from "../../../lib/entities.ts";
import { getModels } from "../../../lib/queries.ts";
import { normName } from "../../../pipeline/models.ts";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/x">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { title: dict(lang).topics, alternates: alternates(lang, "/x") };
}

export default async function Topics({ params }: PageProps<"/[lang]/x">) {
  const lang = asLang((await params).lang);
  const t = dict(lang);
  const [topics, models] = await Promise.all([listEntities(), getModels()]);
  const max = Math.max(1, ...topics.map((e) => e.recent));
  // Names on the leaderboards are models; the rest are companies and products.
  const modelNames = new Set(models.map((m) => normName(m.name)));
  const groups = [
    { title: t.labels.models, items: topics.filter((e) => modelNames.has(normName(e.name))) },
    { title: t.companiesProducts, items: topics.filter((e) => !modelNames.has(normName(e.name))) },
  ].filter((g) => g.items.length);
  return (
    <>
      <h1 className="event">{t.topics}</h1>
      <p className="tagline">{t.topicsIntro}</p>
      {topics.length === 0 && <p className="card">{t.noEvents}</p>}
      {groups.map((g) => (
        <section key={g.title}>
          <h2>{g.title}</h2>
          <ul className="topic-index">
            {g.items.map((e) => (
              <li key={e.slug}>
                <Link href={`/${lang}/x/${e.slug}`}>{e.name}</Link>
                <span className="spark" style={{ width: `${(e.recent / max) * 100}%` }} />
                <span className="meta-inline">
                  {e.stories.length} {t.storiesLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
