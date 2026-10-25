"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { getDb } from "../../../lib/db.ts";
import { sendEmail, esc } from "../../../lib/email.ts";
import { asLang } from "../../../lib/lang.ts";
import { SITE_URL } from "../../../config/site.ts";

const CONFIRM: Record<string, { subject: string; body: string }> = {
  en: { subject: "Confirm your AInstant subscription", body: "Click to confirm your daily AInstant email:" },
  zh: { subject: "确认订阅 AInstant", body: "点击确认订阅 AInstant 每日邮件：" },
};

/** Double opt-in: store unconfirmed, email a confirmation link. Re-subscribing re-sends the link. */
export async function subscribe(form: FormData) {
  const lang = asLang(String(form.get("lang")));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  let tz = String(form.get("timezone") ?? "UTC");
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`/${lang}/subscribe?error=email`);

  const db = await getDb();
  const [row] = await db.query<{ token: string }>(
    `insert into subscribers (email, lang, timezone, token) values ($1, $2, $3, $4)
     on conflict (email) do update set lang = excluded.lang, timezone = excluded.timezone, unsubscribed_at = null
     returning token`,
    [email, lang, tz, randomBytes(18).toString("base64url")],
  );
  const url = `${SITE_URL}/api/confirm?token=${row.token}`;
  const c = CONFIRM[lang] ?? CONFIRM.en;
  await sendEmail({ to: email, subject: c.subject, text: `${c.body}\n${url}`, html: `<p>${esc(c.body)}</p><p><a href="${url}">${url}</a></p>` });
  redirect(`/${lang}/subscribe?sent=1`);
}
