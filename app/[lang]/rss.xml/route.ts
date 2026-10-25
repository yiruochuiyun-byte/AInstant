import { getHeadlines } from "../../../lib/queries.ts";
import { asLang } from "../../../lib/lang.ts";
import { dict } from "../../../lib/i18n.ts";
import { esc } from "../../../lib/email.ts";
import { SITE_NAME, SITE_URL } from "../../../config/site.ts";

/** /en/rss.xml, /zh/rss.xml; ?category=models for one section. */
export async function GET(req: Request, ctx: RouteContext<"/[lang]/rss.xml">) {
  const lang = asLang((await ctx.params).lang);
  const category = new URL(req.url).searchParams.get("category") ?? undefined;
  const events = await getHeadlines(lang, { category, limit: 50 });
  const t = dict(lang);
  const items = events
    .map(
      (e) => `<item><title>${esc(e.title)}</title><link>${SITE_URL}/${lang}/e/${e.slug}</link><guid isPermaLink="false">ainstant-event-${e.id}</guid>` +
        `<pubDate>${new Date(e.last_item_at).toUTCString()}</pubDate>${e.why ? `<description>${esc(e.why)}</description>` : ""}` +
        (e.category ? `<category>${esc(t.labels[e.category] ?? e.category)}</category>` : "") + `</item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_NAME}${category ? ` · ${esc(t.labels[category] ?? category)}` : ""}</title>` +
    `<link>${SITE_URL}/${lang}</link><description>${esc(t.tagline)}</description><language>${lang}</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
