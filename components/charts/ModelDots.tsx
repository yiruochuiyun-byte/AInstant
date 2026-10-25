// Dot plot of mainstream models: x = release date, y = leaderboard score, one small panel per kind of model.
// Server-rendered SVG; native <title> tooltips; dots link to the model's story when there is one.
import Link from "next/link";
import type { ModelPoint } from "../../lib/queries.ts";
import type { Lang } from "../../config/site.ts";
import { dict } from "../../lib/i18n.ts";
import { NEW_DAYS, panels, type Panel } from "../../lib/modelPanels.ts";

const MONTHS = 18;
const W = 360;
const H = 210;
const M = { top: 12, right: 12, bottom: 22, left: 34 };

function niceRange(values: number[]): [number, number, number[]] {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = hi - lo || 1;
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((s) => span / s <= 4) ?? 500;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  return [lo, hi, ticks];
}

function PanelSvg({ lang, p, now }: { lang: Lang; p: Panel; now: number }) {
  const t = dict(lang);
  const x0 = new Date(now);
  x0.setUTCMonth(x0.getUTCMonth() - MONTHS, 1);
  const tMin = x0.getTime();
  const pts = p.points.filter(({ m }) => Date.parse(m.released_on!) >= tMin);
  if (!pts.length) return null;
  const [lo, hi, yTicks] = niceRange(pts.map((d) => d.y));
  const x = (d: string | number) => M.left + ((new Date(d).getTime() - tMin) / (now - tMin)) * (W - M.left - M.right);
  const y = (v: number) => H - M.bottom - ((v - lo) / (hi - lo || 1)) * (H - M.top - M.bottom);
  const isNew = (m: ModelPoint) => now - Date.parse(m.released_on!) <= NEW_DAYS * 864e5;

  // Quarter ticks on the x axis.
  const xTicks: Date[] = [];
  for (const d = new Date(tMin); d.getTime() <= now; d.setUTCMonth(d.getUTCMonth() + 1)) {
    if (d.getUTCMonth() % 3 === 0) xTicks.push(new Date(d));
  }
  const fmtMonth = (d: Date) =>
    lang === "zh" ? `${String(d.getUTCFullYear()).slice(2)}年${d.getUTCMonth() + 1}月` : d.toLocaleString("en", { month: "short", year: "2-digit", timeZone: "UTC" });

  const old = pts.filter((d) => !isNew(d.m));
  const fresh = pts.filter((d) => isNew(d.m)).sort((a, b) => b.y - a.y);
  // Direct labels for new models and the current leader; nudge apart so they never overlap.
  const leader = [...pts].sort((a, b) => b.y - a.y)[0];
  const labelled = [...fresh.slice(0, 4), ...(isNew(leader.m) ? [] : [leader])].sort((a, b) => y(a.y) - y(b.y));
  let lastY = -Infinity;
  const labels = labelled.map((d) => {
    const ly = Math.max(y(d.y) + 4, lastY + 12);
    lastY = ly;
    const cx = x(d.m.released_on!);
    const right = cx < W * 0.6;
    return { d, lx: right ? cx + 8 : cx - 8, ly, anchor: right ? "start" : "end" };
  });

  const dot = ({ m, y: v }: Panel["points"][number], cls: string) => {
    const tip = `${m.name}${m.creator ? ` · ${m.creator}` : ""}\n${t.modelScore[p.key]}: ${Math.round(v * 10) / 10}\n${m.released_on}`;
    const c = (
      <g key={`${m.id}-${cls}`} className={cls}>
        <title>{tip}</title>
        <circle cx={x(m.released_on!)} cy={y(v)} r={9} className="hit" />
        <circle cx={x(m.released_on!)} cy={y(v)} r={4} />
      </g>
    );
    return m.slug ? (
      <Link key={`${m.id}-${cls}`} href={`/${lang}/e/${m.slug}`}>
        {c}
      </Link>
    ) : (
      c
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.modelPanels[p.key]}: ${pts.length}`} className="dots">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} className="grid" />
          <text x={M.left - 5} y={y(v) + 3.5} textAnchor="end" className="tick">
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((d) => (
        <text key={d.toISOString()} x={x(d.getTime())} y={H - 6} textAnchor="middle" className="tick">
          {fmtMonth(d)}
        </text>
      ))}
      {old.map((d) => dot(d, "old"))}
      {fresh.map((d) => dot(d, "new"))}
      {labels.map(({ d, lx, ly, anchor }) => (
        <text key={`l-${d.m.id}`} x={lx} y={ly} textAnchor={anchor as "start" | "end"} className={isNew(d.m) ? "lbl new" : "lbl"}>
          {d.m.name}
        </text>
      ))}
    </svg>
  );
}

export function ModelDots({ lang, models, now = Date.now() }: { lang: Lang; models: ModelPoint[]; now?: number }) {
  const t = dict(lang);
  const ps = panels(models);
  if (!ps.length) return null;
  return (
    <div className="model-dots">
      <div className="legend">
        <span>
          <i className="sw new" /> {t.releasedWithin(NEW_DAYS)}
        </span>
        <span>
          <i className="sw old" /> {t.releasedEarlier}
        </span>
      </div>
      <div className="panels">
        {ps.map((p) => (
          <figure key={p.key}>
            <figcaption>
              <b>{t.modelPanels[p.key]}</b> <span>{t.modelScore[p.key]}</span>
            </figcaption>
            <PanelSvg lang={lang} p={p} now={now} />
            {p.undated > 0 && <p className="fine">{t.undated(p.undated)}</p>}
          </figure>
        ))}
      </div>
      <p className="fine">
        {t.scoresBy}{" "}
        <a href="https://artificialanalysis.ai/" rel="noopener">
          Artificial Analysis
        </a>
      </p>
    </div>
  );
}
