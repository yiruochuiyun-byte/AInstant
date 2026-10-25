import type { Metadata } from "next";
import Link from "next/link";
import "../globals.css";
import { LANGS, SITE_NAME } from "../../config/site.ts";
import { asLang } from "../../lib/lang.ts";
import { dict } from "../../lib/i18n.ts";
import { LangBanner } from "../../components/LangBanner.tsx";
import { LangSwitch } from "../../components/LangSwitch.tsx";

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` }, description: dict(lang).tagline };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const lang = asLang((await params).lang);
  const t = dict(lang);
  return (
    <html lang={lang === "zh" ? "zh-Hans" : lang}>
      <body>
        <LangBanner lang={lang} langs={[...LANGS]} />
        <header className="site">
          <div className="wrap">
            <Link href={`/${lang}`} className="logo">
              AI<span>nstant</span>
            </Link>
            <nav className="main">
              <Link href={`/${lang}`}>{t.home}</Link>
              <Link href={`/${lang}/latest`}>{t.latest}</Link>
              <Link href={`/${lang}/x`}>{t.topics}</Link>
              <Link href={`/${lang}/w`}>{t.weekly}</Link>
              <Link href={`/${lang}/prices`}>{t.prices}</Link>
              <Link href={`/${lang}/subscribe`}>{t.subscribe}</Link>
              <a href={`/${lang}/rss.xml`}>{t.rss}</a>
            </nav>
            <LangSwitch lang={lang} langs={[...LANGS]} />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site">
          <div className="wrap">
            {t.neutralNote} · <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
