import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLang, alternates } from "../../../../lib/lang.ts";
import { dict } from "../../../../lib/i18n.ts";
import { getWeekly } from "../../../../lib/queries.ts";
import { WeeklyView } from "../../../../components/Weekly.tsx";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/w/[week]">): Promise<Metadata> {
  const { lang: l, week } = await params;
  const lang = asLang(l);
  const w = await getWeekly(lang, week);
  if (!w) return {};
  return { title: dict(lang).weeklyTitle(w.week), description: w.intro ?? undefined, alternates: alternates(lang, `/w/${w.week}`) };
}

export default async function Weekly({ params }: PageProps<"/[lang]/w/[week]">) {
  const { lang: l, week } = await params;
  const lang = asLang(l);
  const w = await getWeekly(lang, week);
  if (!w) notFound();
  return <WeeklyView lang={lang} w={w} base={`/${lang}/w`} />;
}
