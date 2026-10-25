import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "../../../lib/db.ts";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const db = await getDb();
  const [s] = await db.query<{ lang: string }>(
    `update subscribers set confirmed_at = coalesce(confirmed_at, now()), unsubscribed_at = null where token = $1 returning lang`,
    [token],
  );
  return NextResponse.redirect(new URL(s ? `/${s.lang}/subscribe?confirmed=1` : "/", req.url));
}
