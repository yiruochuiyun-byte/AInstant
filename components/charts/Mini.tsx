// Small server-rendered charts for the topic cards.
import Link from "next/link";
import type { Incident, PriceRow, RisingTag } from "../../lib/queries.ts";
import type { Lang } from "../../config/site.ts";
import { dict } from "../../lib/i18n.ts";

/** New stories per day; today is the last bar. */
export function DailyBars({ lang, counts, label }: { lang: Lang; counts: number[]; label: string }) {
  const t = dict(lang);
  const W = 360;
  const H = 64;
  const max = Math.max(1, ...counts);
  const bw = W / counts.length;
  const total = counts.reduce((a, b) => a + b, 0);
  const week = counts.slice(-7).reduce((a, b) => a + b, 0);
  const prev = total - week;
  return (
    <figure className="mini">
      <figcaption>
        <b>{t.storiesThisWeek(week)}</b> <span className={week >= prev ? "up" : "down"}>{t.vsLastWeek(week - prev)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${counts.join(", ")}`} className="bars">
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className="grid" />
        {counts.map((n, i) => {
          const h = (n / max) * (H - 6);
          return (
            <g key={i}>
              <title>{t.daysAgoCount(counts.length - 1 - i, n)}</title>
              <rect x={i * bw + 1} y={H - h} width={bw - 2} height={Math.max(h, n ? 2 : 0)} rx={2} className={i >= counts.length - 7 ? "cur" : "prev"} />
            </g>
          );
        })}
      </svg>
      <div className="axis-ends">
        <span>{t.daysAgoShort(counts.length - 1)}</span>
        <span>{t.today}</span>
      </div>
    </figure>
  );
}

/** Safety incidents over the last 30 days, one dot per story, bigger when hotter. */
export function IncidentStrip({ lang, items, now = Date.now(), days = 30 }: { lang: Lang; items: Incident[]; now?: number; days?: number }) {
  const t = dict(lang);
  const W = 360;
  const H = 56;
  const max = Math.max(1, ...items.map((i) => i.hotness));
  const x = (d: Date) => 8 + (1 - (now - new Date(d).getTime()) / (days * 864e5)) * (W - 16);
  return (
    <figure className="mini">
      <figcaption>
        <b>{t.incidentsIn(items.length, days)}</b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.incidentsIn(items.length, days)} className="strip">
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="grid" />
        {items.map((i) => (
          <Link key={i.slug} href={`/${lang}/e/${i.slug}`}>
            <g className={i.has_controversy ? "disputed" : ""}>
              <title>{i.title}</title>
              <circle cx={x(i.first_seen_at)} cy={H / 2} r={12} className="hit" />
              <circle cx={x(i.first_seen_at)} cy={H / 2} r={4 + 6 * Math.sqrt(i.hotness / max)} />
            </g>
          </Link>
        ))}
      </svg>
      <div className="axis-ends">
        <span>{t.daysAgoShort(days)}</span>
        <span>{t.today}</span>
      </div>
    </figure>
  );
}

/** Recent price changes as % bars; cuts point left. */
export function PriceChanges({ lang, rows }: { lang: Lang; rows: PriceRow[] }) {
  const t = dict(lang);
  const changes = rows
    .filter((r) => r.prev_prompt && r.prev_prompt > 0)
    .map((r) => ({ name: r.name.replace(/^[^:]+:\s*/, ""), pct: Math.round(((r.prompt - r.prev_prompt!) / r.prev_prompt!) * 100) }))
    .filter((r) => r.pct !== 0)
    .slice(0, 5);
  if (!changes.length) return null;
  const max = Math.max(...changes.map((c) => Math.abs(c.pct)));
  return (
    <figure className="mini">
      <figcaption>
        <b>{t.recentChanges}</b> <span>{t.input}</span>
      </figcaption>
      <ul className="pct">
        {changes.map((c) => (
          <li key={c.name}>
            <span className="name">{c.name}</span>
            <span className="track">
              <i className={c.pct < 0 ? "cut" : "rise"} style={{ width: `${(Math.abs(c.pct) / max) * 100}%` }} />
            </span>
            <span className={c.pct < 0 ? "num down" : "num up"}>{c.pct > 0 ? `+${c.pct}` : c.pct}%</span>
          </li>
        ))}
      </ul>
      <Link href={`/${lang}/prices`} className="more">
        {t.prices} →
      </Link>
    </figure>
  );
}

/** Tags on this week's stories, with last week's count for comparison. */
export function RisingTags({ lang, tags }: { lang: Lang; tags: RisingTag[] }) {
  const t = dict(lang);
  if (!tags.length) return null;
  const max = Math.max(...tags.map((x) => Math.max(x.now, x.before)));
  return (
    <figure className="mini">
      <figcaption>
        <b>{t.risingTopics}</b> <span>{t.thisWeekVsLast}</span>
      </figcaption>
      <ul className="pct tags">
        {tags.map((x) => (
          <li key={x.tag}>
            <Link className="name" href={`/${lang}/latest?tag=${encodeURIComponent(x.tag)}`}>
              #{x.tag}
            </Link>
            <span className="track">
              <i className="prev" style={{ width: `${(x.before / max) * 100}%` }} />
              <i className="cur" style={{ width: `${(x.now / max) * 100}%` }} />
            </span>
            <span className="num">
              {x.now} <small>/ {x.before}</small>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** One row per section: tiny daily bars, this week's count and the change from last week. */
export function TrendRows({ lang, counts }: { lang: Lang; counts: Record<string, number[]> }) {
  const t = dict(lang);
  const rows = Object.entries(counts)
    .map(([cat, c]) => {
      const week = c.slice(-7).reduce((a, b) => a + b, 0);
      return { cat, c, week, delta: week - c.slice(0, -7).reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.week - a.week);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.flatMap((r) => r.c));
  return (
    <figure className="mini">
      <figcaption>
        <b>{t.storiesPerDay}</b> <span>{t.last14Days}</span>
      </figcaption>
      <ul className="trend-rows">
        {rows.map((r) => (
          <li key={r.cat}>
            <Link className="name" href={`/${lang}/t/${r.cat}`}>
              {t.labels[r.cat] ?? r.cat}
            </Link>
            <svg viewBox="0 0 140 24" role="img" aria-label={`${t.labels[r.cat]}: ${r.c.join(", ")}`}>
              {r.c.map((n, i) => {
                const h = (n / max) * 22;
                return <rect key={i} x={i * 10 + 1} y={24 - h} width={8} height={Math.max(h, n ? 2 : 0)} rx={1.5} className={i >= r.c.length - 7 ? "cur" : "prev"} />;
              })}
            </svg>
            <span className="num">{r.week}</span>
            <span className={`num ${r.delta > 0 ? "up" : r.delta < 0 ? "down" : ""}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
