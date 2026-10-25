import type { Metadata } from "next";
import Link from "next/link";
import { asLang, alternates } from "../../lib/lang.ts";
import { dict } from "../../lib/i18n.ts";
import { getHeadlines, getSponsor } from "../../lib/queries.ts";
import { EventCard } from "../../components/EventCard.tsx";
import { Sponsored } from "../../components/Sponsored.tsx";
import { CATEGORIES, ITEM_TYPES } from "../../lib/types.ts";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { alternates: alternates(lang) };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Home({ params, searchParams }: PageProps<"/[lang]">) {
  const lang = asLang((await params).lang);
  const q = await searchParams;
  const filters = { category: one(q.category), type: one(q.type), tag: one(q.tag) };
  const t = dict(lang);
  const [events, sponsor] = await Promise.all([getHeadlines(lang, filters), getSponsor(lang, "home")]);

  const href = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/${lang}${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <p className="tagline">{t.tagline}</p>
      <nav className="filters" aria-label={t.category}>
        <span className="label">{t.category}</span>
        <Link href={href({ category: undefined })} aria-current={!filters.category ? "true" : undefined}>{t.all}</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={href({ category: c })} aria-current={filters.category === c ? "true" : undefined}>{t.labels[c]}</Link>
        ))}
      </nav>
      <nav className="filters" aria-label={t.type}>
        <span className="label">{t.type}</span>
        <Link href={href({ type: undefined })} aria-current={!filters.type ? "true" : undefined}>{t.all}</Link>
        {ITEM_TYPES.map((c) => (
          <Link key={c} href={href({ type: c })} aria-current={filters.type === c ? "true" : undefined}>{t.labels[c]}</Link>
        ))}
        {filters.tag && <Link href={href({ tag: undefined })} aria-current="true">#{filters.tag} ×</Link>}
      </nav>
      {events.length === 0 && <p className="card">{t.noEvents}</p>}
      {events.map((e, i) => (
        <div key={e.id}>
          <EventCard lang={lang} e={e} />
          {i === 2 && sponsor && <Sponsored lang={lang} s={sponsor} />}
        </div>
      ))}
      {events.length > 0 && events.length <= 2 && sponsor && <Sponsored lang={lang} s={sponsor} />}
    </>
  );
}
