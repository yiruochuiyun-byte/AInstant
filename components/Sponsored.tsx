import type { Sponsor } from "../lib/queries.ts";
import { dict } from "../lib/i18n.ts";
import type { Lang } from "../config/site.ts";

/** Paid placement. The label is not optional. */
export function Sponsored({ lang, s }: { lang: Lang; s: Sponsor }) {
  return (
    <aside className="sponsored">
      <div className="tag">{dict(lang).sponsored}</div>
      <a href={s.url} rel="sponsored noopener" target="_blank">
        <strong>{s.title}</strong>
      </a>
      {s.body && <div>{s.body}</div>}
    </aside>
  );
}
