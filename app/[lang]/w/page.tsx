import type { Metadata } from "next";
import Link from "next/link";
import { asLang, alternates } from "../../../lib/lang.ts";
import { dict } from "../../../lib/i18n.ts";
import { listWeeklies } from "../../../lib/queries.ts";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/w">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { title: dict(lang).weekly, alternates: alternates(lang, "/w") };
}

export default async function Weeklies({ params }: PageProps<"/[lang]/w">) {
  const lang = asLang((await params).lang);
  const t = dict(lang);
  const issues = await listWeeklies(lang);
  return (
    <>
      <h1 className="event">AInstant {t.weekly}</h1>
      <p className="tagline">{t.weeklyIntro}</p>
      <p>
        <Link href={`/${lang}/subscribe?frequency=weekly`}>{t.getWeekly} →</Link>
      </p>
      {issues.length === 0 && <p className="card">{t.noWeeklies}</p>}
      {issues.map((w) => (
        <article key={w.week} className="card">
          <h2>
            <Link href={`/${lang}/w/${w.week}`}>{t.weeklyTitle(w.week)}</Link>
          </h2>
          {w.intro && <p className="why">{w.intro}</p>}
        </article>
      ))}
    </>
  );
}
