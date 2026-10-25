import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LANG } from "./config/site.ts";

// "/" goes to the English edition; readers are offered their language by a banner, never redirected by IP.
// /admin is behind HTTP basic auth (ADMIN_PASSWORD).
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") return NextResponse.redirect(new URL(`/${DEFAULT_LANG}`, req.url));

  if (pathname.startsWith("/admin")) {
    const pass = process.env.ADMIN_PASSWORD;
    const auth = req.headers.get("authorization") ?? "";
    const [, encoded] = auth.split(" ");
    const given = encoded ? atob(encoded).split(":").slice(1).join(":") : "";
    if (!pass || given !== pass) {
      return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="AInstant admin"' } });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/admin/:path*"] };
