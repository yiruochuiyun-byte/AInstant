import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "../../../lib/db.ts";

/**
 * Push endpoint for the Grok bot (X) and other watchers.
 * POST with header "Authorization: Bearer $INGEST_TOKEN" and JSON
 * {"url": "...", "title": "...", "note": "...", "author": "...", "lang": "zh"} or an array of those.
 * Items land in the inbox table; the next pipeline run picks them up.
 */
export async function POST(req: NextRequest) {
  const token = process.env.INGEST_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const list = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const db = await getDb();
  let queued = 0;
  for (const it of list.slice(0, 100)) {
    const url = str(it?.url, 2000);
    if (!url || !/^https?:\/\//.test(url)) continue;
    await db.query(`insert into inbox (url, title, note, author, lang) values ($1, $2, $3, $4, $5)`, [
      url, str(it.title, 300), str(it.note, 1000), str(it.author, 100), str(it.lang, 5),
    ]);
    queued++;
  }
  return NextResponse.json({ queued });
}
