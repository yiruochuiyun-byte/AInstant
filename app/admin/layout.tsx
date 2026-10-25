import Link from "next/link";
import "../globals.css";

export const metadata = { title: "AInstant admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en">
      <body className="admin">
        <header className="site">
          <div className="wrap">
            <Link href="/admin" className="logo">AI<span>nstant</span> admin</Link>
            <nav className="main">
              <Link href="/admin">Queue</Link>
              <Link href="/admin?view=live">Live</Link>
              <Link href="/admin?view=sources">Sources</Link>
              <Link href="/en">Site ↗</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
