import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "../../../lib/db.ts";

async function unsubscribe(token: string) {
  const db = await getDb();
  const [s] = await db.query<{ lang: string }>(`update subscribers set unsubscribed_at = now() where token = $1 returning lang`, [token]);
  return s;
}

/** Link in the email footer. */
export async function GET(req: NextRequest) {
  const s = await unsubscribe(req.nextUrl.searchParams.get("token") ?? "");
  return NextResponse.redirect(new URL(s ? `/${s.lang}/subscribe?unsubscribed=1` : "/", req.url));
}

/** One-click unsubscribe from the mail client (List-Unsubscribe-Post). */
export async function POST(req: NextRequest) {
  await unsubscribe(req.nextUrl.searchParams.get("token") ?? "");
  return new NextResponse(null, { status: 204 });
}
