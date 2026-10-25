"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAMES: Record<string, string> = { en: "EN", zh: "中文", de: "DE" };

/** Same page in another language: swap the first path segment. */
export function LangSwitch({ lang, langs }: { lang: string; langs: string[] }) {
  const path = usePathname() ?? `/${lang}`;
  return (
    <div className="langs">
      {langs.map((l) => (
        <Link key={l} href={path.replace(/^\/[a-z]{2}(?=\/|$)/, `/${l}`)} aria-current={l === lang ? "true" : undefined} hrefLang={l}>
          {NAMES[l] ?? l}
        </Link>
      ))}
    </div>
  );
}
