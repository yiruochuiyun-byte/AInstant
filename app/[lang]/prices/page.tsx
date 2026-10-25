import type { Metadata } from "next";
import { asLang, alternates } from "../../../lib/lang.ts";
import { dict } from "../../../lib/i18n.ts";
import { getPrices, type PriceRow } from "../../../lib/queries.ts";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/prices">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { title: dict(lang).prices, alternates: alternates(lang, "/prices") };
}

const usd = (n: number | null) => (n === null ? "" : n === 0 ? "free" : `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`);

function Delta({ now, before }: { now: number; before: number | null }) {
  if (before === null || before === now || before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return <span className={pct < 0 ? "down" : "up"}> {pct > 0 ? "+" : ""}{pct}%</span>;
}

export default async function Prices({ params }: PageProps<"/[lang]/prices">) {
  const lang = asLang((await params).lang);
  const t = dict(lang);
  const rows = await getPrices();
  const changed = rows.filter((r) => r.prev_prompt !== null);
  const fmt = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeZone: "UTC" });

  const table = (list: PriceRow[]) => (
    <div className="table-scroll">
      <table className="prices">
        <thead>
          <tr>
            <th>{t.model}</th>
            <th className="num">{t.input}</th>
            <th className="num">{t.output}</th>
            <th className="num">{t.context}</th>
            <th className="num">{t.changed}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.model_id}>
              <td>
                <a href={`https://openrouter.ai/${r.model_id}`} target="_blank" rel="noopener">{r.name}</a>
              </td>
              <td className="num">{usd(r.prompt)}<Delta now={r.prompt} before={r.prev_prompt} /></td>
              <td className="num">{usd(r.completion)}<Delta now={r.completion} before={r.prev_completion} /></td>
              <td className="num">{r.context_length ? `${Math.round(r.context_length / 1000)}K` : ""}</td>
              <td className="num">{fmt.format(new Date(r.captured_at))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <h1 className="event">{t.prices}</h1>
      <p className="tagline">{t.pricesIntro}</p>
      {changed.length > 0 && (
        <>
          <h2>{t.recentChanges}</h2>
          {table(changed)}
        </>
      )}
      <h2>{t.all}</h2>
      {table(rows)}
    </>
  );
}
