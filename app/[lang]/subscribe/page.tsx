import type { Metadata } from "next";
import { asLang, alternates } from "../../../lib/lang.ts";
import { dict } from "../../../lib/i18n.ts";
import { subscribe } from "./actions.ts";
import { TimezoneInput } from "../../../components/TimezoneInput.tsx";

export async function generateMetadata({ params }: PageProps<"/[lang]/subscribe">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { title: dict(lang).subscribe, alternates: alternates(lang, "/subscribe") };
}

export default async function Subscribe({ params, searchParams }: PageProps<"/[lang]/subscribe">) {
  const lang = asLang((await params).lang);
  const q = await searchParams;
  const t = dict(lang);
  const message = q.sent ? t.checkInbox : q.confirmed ? t.confirmed : q.unsubscribed ? t.unsubscribed : null;
  return (
    <>
      <h1 className="event">{t.subscribe}</h1>
      <p className="tagline">{t.subscribeIntro}</p>
      {message ? (
        <p className="note">{message}</p>
      ) : (
        <form action={subscribe} className="stack">
          <input type="hidden" name="lang" value={lang} />
          <label>
            {t.email}
            <br />
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <TimezoneInput label={t.timezone} />
          <fieldset className="choice">
            <legend>{t.frequency}</legend>
            <label>
              <input type="radio" name="frequency" value="daily" defaultChecked={q.frequency !== "weekly"} /> {t.freqDaily}
            </label>
            <label>
              <input type="radio" name="frequency" value="weekly" defaultChecked={q.frequency === "weekly"} /> {t.freqWeekly}
            </label>
          </fieldset>
          <button type="submit">{t.subscribeButton}</button>
          {q.error && <p className="note">{t.email} ✕</p>}
        </form>
      )}
    </>
  );
}
