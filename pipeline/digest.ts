// Daily email. Runs hourly (Railway cron "0 * * * *"); each run mails confirmed subscribers
// for whom it is now 8:xx local time and who have not had today's email yet.
import { getDb } from "../lib/db.ts";
import { getHeadlines, getSponsor, type EventCard } from "../lib/queries.ts";
import { dict } from "../lib/i18n.ts";
import { sendEmail, esc } from "../lib/email.ts";
import { log } from "../lib/util.ts";
import { LANGS, SITE_URL, type Lang } from "../config/site.ts";

const SEND_HOUR = 8;

export function localClock(timeZone: string, now: Date): { hour: number; date: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
}

const SUBJECT: Record<Lang, (top: string) => string> = {
  en: (top) => `AInstant: ${top}`,
  zh: (top) => `AInstant 每日：${top}`,
};

export function renderDigest(lang: Lang, events: EventCard[], sponsor: { title: string; body: string | null; url: string } | null, unsubscribeUrl: string) {
  const t = dict(lang);
  const link = (e: EventCard) => `${SITE_URL}/${lang}/e/${e.slug}`;
  const sponsorHtml = sponsor
    ? `<div style="border:1px dashed #ccc;padding:10px;margin:16px 0"><div style="font-size:11px;color:#888;text-transform:uppercase">${esc(t.sponsored)}</div><a href="${esc(sponsor.url)}">${esc(sponsor.title)}</a>${sponsor.body ? `<div>${esc(sponsor.body)}</div>` : ""}</div>`
    : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,PingFang SC,sans-serif;max-width:600px;margin:auto;line-height:1.5">
<h1 style="font-size:20px">AInstant</h1>
${events.map((e, i) => `<div style="margin:0 0 16px"><a href="${link(e)}" style="font-size:17px;font-weight:600;color:#111">${esc(e.title)}</a>${e.why ? `<div style="color:#444">${esc(e.why)}</div>` : ""}<div style="font-size:12px;color:#888">${esc(t.labels[e.category ?? ""] ?? "")} · ${t.sources(e.source_count)}</div></div>${i === 2 ? sponsorHtml : ""}`).join("\n")}
${events.length < 3 ? sponsorHtml : ""}
<p style="font-size:12px;color:#888"><a href="${unsubscribeUrl}">Unsubscribe / 退订</a></p></div>`;
  const text = events.map((e) => `• ${e.title}\n  ${e.why ?? ""}\n  ${link(e)}`).join("\n\n") + `\n\nUnsubscribe: ${unsubscribeUrl}`;
  return { subject: SUBJECT[lang](events[0]?.title ?? ""), html, text };
}

export async function sendDue(now = new Date()): Promise<number> {
  const db = await getDb();
  const subs = await db.query<{ id: number; email: string; lang: Lang; timezone: string; token: string; last_sent_on: string | null }>(
    `select id, email, lang, timezone, token, to_char(last_sent_on, 'YYYY-MM-DD') as last_sent_on
       from subscribers where confirmed_at is not null and unsubscribed_at is null`,
  );
  const cache = new Map<Lang, { events: EventCard[]; sponsor: Awaited<ReturnType<typeof getSponsor>> }>();
  let sent = 0;
  for (const s of subs) {
    let clock;
    try {
      clock = localClock(s.timezone, now);
    } catch {
      clock = localClock("UTC", now);
    }
    if (clock.hour !== SEND_HOUR || s.last_sent_on === clock.date) continue;
    const lang = (LANGS as readonly string[]).includes(s.lang) ? s.lang : "en";
    if (!cache.has(lang)) cache.set(lang, { events: await getHeadlines(lang, { sinceHours: 24, limit: 10 }), sponsor: await getSponsor(lang, "newsletter") });
    const { events, sponsor } = cache.get(lang)!;
    if (events.length === 0) continue;
    const unsub = `${SITE_URL}/api/unsubscribe?token=${s.token}`;
    const mail = renderDigest(lang, events, sponsor, unsub);
    try {
      await sendEmail({ to: s.email, ...mail, unsubscribeUrl: unsub });
      await db.query(`update subscribers set last_sent_on = $2::date where id = $1`, [s.id, clock.date]);
      sent++;
    } catch (err) {
      log(`digest to subscriber ${s.id} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return sent;
}

if (import.meta.main) {
  const n = await sendDue();
  log(`digest sent: ${n}`);
  await (await getDb()).close();
}
