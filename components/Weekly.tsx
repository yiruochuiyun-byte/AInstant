import Link from "next/link";
import type { WeeklyIssue } from "../lib/queries.ts";
import type { Lang } from "../config/site.ts";
import { dict } from "../lib/i18n.ts";
import { Labels } from "./EventCard.tsx";

/** One weekly issue. Used by the public page and the admin preview. */
export function WeeklyView({ lang, w, base }: { lang: Lang; w: WeeklyIssue; base: string }) {
  const t = dict(lang);
  const sections = w.stats.sections ?? [];
  const max = Math.max(1, ...sections.flatMap((s) => [s.now, s.before]));
  const models = w.stats.models ?? [];
  const tags = w.stats.tags ?? [];
  return (
    <article className="weekly">
      <h1 className="event">{t.weeklyTitle(w.week)}</h1>
      <p className="meta">{t.weekRange(w.week, w.starts_at, w.ends_at)}</p>
      {w.intro && (
        <>
          <p className="lede">{w.intro}</p>
          <p className="fine">{t.weeklyIntroNote}</p>
        </>
      )}

      <h2>{t.topStories}</h2>
      <ol className="top-stories">
        {w.top.map((e) => (
          <li key={e.id}>
            <h3>
              <Link href={`/${lang}/e/${e.slug}`}>{e.title}</Link>
            </h3>
            {e.why && <p className="why">{e.why}</p>}
            <div className="meta">
              <Labels lang={lang} e={e} />
              <span>{t.sources(e.source_count)}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="weekly-grid">
        {models.length > 0 && (
          <section>
            <h2>{t.newModels}</h2>
            <ul className="plain">
              {models.map((m) => (
                <li key={`${m.modality}:${m.name}`}>
                  <span className={`chip mod-${m.modality}`}>{t.modelPanels[m.modality] ?? m.modality}</span> <b>{m.name}</b>
                  {m.creator && <span className="meta-inline"> · {m.creator}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {sections.length > 0 && (
          <section>
            <h2>{t.bySection}</h2>
            <table className="week-bars">
              <tbody>
                {sections.map((s) => (
                  <tr key={s.category}>
                    <th>{t.labels[s.category] ?? s.category}</th>
                    <td>
                      <span className="bar cur" style={{ width: `${(s.now / max) * 100}%` }} title={`${t.thisWeek}: ${s.now}`} />
                      <span className="bar prev" style={{ width: `${(s.before / max) * 100}%` }} title={`${t.lastWeek}: ${s.before}`} />
                    </td>
                    <td className="num">
                      {s.now} <span className={s.now >= s.before ? "up" : "down"}>{t.vsLastWeek(s.now - s.before)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="fine">
              <span className="key cur" /> {t.thisWeek} <span className="key prev" /> {t.lastWeek}
            </p>
          </section>
        )}
        {tags.length > 0 && (
          <section>
            <h2>{t.risingTopics}</h2>
            <p className="tags">
              {tags.map((g) => (
                <Link key={g.tag} className="chip" href={`/${lang}/latest?tag=${encodeURIComponent(g.tag)}`}>
                  #{g.tag} <span className="up">{g.now}</span>/{g.before}
                </Link>
              ))}
            </p>
          </section>
        )}
      </div>

      {w.more.length > 0 && (
        <>
          <h2>{t.alsoThisWeek}</h2>
          <ul className="plain also">
            {w.more.map((e) => (
              <li key={e.id}>
                <Link href={`/${lang}/e/${e.slug}`}>{e.title}</Link> <span className="meta-inline">{t.labels[e.category ?? ""]}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <nav className="issue-nav">
        {w.prev ? <Link href={`${base}/${w.prev}`}>← {t.prevIssue}</Link> : <span />}
        <Link href={`/${lang}/subscribe?frequency=weekly`}>{t.getWeekly}</Link>
        {w.next ? <Link href={`${base}/${w.next}`}>{t.nextIssue} →</Link> : <span />}
      </nav>
    </article>
  );
}
