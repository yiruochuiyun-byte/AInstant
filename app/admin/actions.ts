"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, type Db } from "../../lib/db.ts";
import { slugify } from "../../pipeline/events.ts";

// Every human change is written to corrections. Headline and summary edits are public; moderation steps are internal.

async function correction(db: Db, eventId: number, field: string, oldValue: string | null, newValue: string | null, reason: string | null, isPublic: boolean) {
  await db.query(
    `insert into corrections (event_id, field, old_value, new_value, reason, editor, public) values ($1, $2, $3, $4, $5, 'admin', $6)`,
    [eventId, field, oldValue, newValue, reason, isPublic],
  );
}

const refresh = () => revalidatePath("/", "layout");

export async function setStatus(form: FormData) {
  const id = Number(form.get("id"));
  const status = String(form.get("status"));
  if (!["approved", "hidden", "pending_review", "auto"].includes(status)) return;
  const db = await getDb();
  const [old] = await db.query<{ status: string }>(`select status from events where id = $1`, [id]);
  await db.query(`update events set status = $2 where id = $1`, [id, status]);
  await correction(db, id, "status", old?.status ?? null, status, null, false);
  refresh();
}

export async function togglePin(form: FormData) {
  const id = Number(form.get("id"));
  const db = await getDb();
  const [r] = await db.query<{ pinned: boolean }>(`update events set pinned = not pinned where id = $1 returning pinned`, [id]);
  await correction(db, id, "pinned", String(!r.pinned), String(r.pinned), null, false);
  refresh();
}

export async function editEvent(form: FormData) {
  const id = Number(form.get("id"));
  const title = String(form.get("title_en") ?? "").trim();
  const why = String(form.get("why_en") ?? "").trim() || null;
  const reason = String(form.get("reason") ?? "").trim() || null;
  const db = await getDb();
  const [old] = await db.query<{ title_en: string; why_en: string | null }>(`select title_en, why_en from events where id = $1`, [id]);
  if (!old || !title) return;
  if (title !== old.title_en) await correction(db, id, "title", old.title_en, title, reason, true);
  if (why !== old.why_en) await correction(db, id, "why", old.why_en, why, reason, true);
  // Slug stays: published URLs must not break. Translations refresh because the English text hash changes.
  await db.query(`update events set title_en = $2, why_en = $3, title_locked = true where id = $1`, [id, title, why]);
  refresh();
}

async function recount(db: Db, eventId: number) {
  await db.query(
    `update events set
       item_count = (select count(*) from items where event_id = $1),
       centroid = coalesce((select avg(embedding) from items where event_id = $1), centroid),
       entities = coalesce((select array(select distinct unnest(entities) from items where event_id = $1)), entities),
       last_item_at = coalesce((select max(coalesce(published_at, fetched_at)) from items where event_id = $1), last_item_at),
       updated_at = now()
     where id = $1`,
    [eventId],
  );
  await db.query(`update events set status = 'hidden' where id = $1 and item_count = 0`, [eventId]);
}

/** Split: move one item to another event, or to a new event of its own. */
export async function moveItem(form: FormData) {
  const itemId = Number(form.get("item_id"));
  const target = String(form.get("target") ?? "").trim();
  const db = await getDb();
  const [it] = await db.query<{ event_id: number; summary_en: string; category: string; item_type: string; tags: string[]; credibility: string; entities: string[]; at: Date }>(
    `select event_id, summary_en, category, item_type, tags, credibility, entities, coalesce(published_at, fetched_at) as at from items where id = $1`,
    [itemId],
  );
  if (!it) return;
  let to: number;
  if (target === "new") {
    const [ev] = await db.query<{ id: number }>(
      `insert into events (title_en, category, item_type, tags, credibility, entities, first_seen_at, last_item_at)
       values ($1, $2, $3, $4, $5, $6, $7, $7) returning id`,
      [it.summary_en, it.category, it.item_type, it.tags, it.credibility, it.entities, it.at],
    );
    to = ev.id;
    await db.query(`update events set slug = $2 where id = $1`, [to, slugify(it.summary_en, to)]);
  } else {
    to = Number(target);
    const [exists] = await db.query(`select 1 from events where id = $1`, [to]);
    if (!exists) return;
  }
  await db.query(`update items set event_id = $2 where id = $1`, [itemId, to]);
  await recount(db, it.event_id);
  await recount(db, to);
  await correction(db, it.event_id, "split", String(itemId), `event ${to}`, null, false);
  refresh();
  redirect(`/admin/e/${to}`);
}

/** Merge: all items of this event go into another; this one is hidden (its URL keeps working only for admins). */
export async function mergeEvent(form: FormData) {
  const from = Number(form.get("id"));
  const into = Number(form.get("into"));
  if (!into || into === from) return;
  const db = await getDb();
  const [exists] = await db.query(`select 1 from events where id = $1`, [into]);
  if (!exists) return;
  await db.query(`update items set event_id = $2 where event_id = $1`, [from, into]);
  await recount(db, from);
  await recount(db, into);
  await correction(db, into, "merge", `event ${from}`, `event ${into}`, null, false);
  refresh();
  redirect(`/admin/e/${into}`);
}

/** Manual submission: same path as the Grok bot. */
export async function submitLink(form: FormData) {
  const url = String(form.get("url") ?? "").trim();
  if (!/^https?:\/\//.test(url)) return;
  const db = await getDb();
  await db.query(`insert into inbox (url, title, note, lang) values ($1, $2, $3, $4)`, [
    url, String(form.get("title") ?? "").trim() || null, String(form.get("note") ?? "").trim() || null, String(form.get("lang") ?? "").trim() || null,
  ]);
  refresh();
}
