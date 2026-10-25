import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../lib/db.ts";
import { editEvent, mergeEvent, moveItem, setStatus } from "../../actions.ts";

export default async function EditEvent({ params }: PageProps<"/admin/e/[id]">) {
  const id = Number((await params).id);
  const db = await getDb();
  const [ev] = await db.query<{ id: number; slug: string | null; title_en: string; why_en: string | null; status: string; title_locked: boolean }>(
    `select id, slug, title_en, why_en, status, title_locked from events where id = $1`,
    [id],
  );
  if (!ev) notFound();
  const items = await db.query<{ id: number; source_id: string; node_type: string; claim_type: string; summary_en: string; url: string; at: Date }>(
    `select id, source_id, node_type, claim_type, summary_en, url, coalesce(published_at, fetched_at) as at from items where event_id = $1 order by 7`,
    [id],
  );
  const log = await db.query<{ field: string; old_value: string | null; new_value: string | null; public: boolean; created_at: Date }>(
    `select field, old_value, new_value, public, created_at from corrections where event_id = $1 order by created_at desc`,
    [id],
  );

  return (
    <>
      <p><Link href="/admin">← Queue</Link> {ev.slug && <Link href={`/en/e/${ev.slug}`}>View on site ↗</Link>}</p>
      <h1>Event #{ev.id} <span className="chip">{ev.status}</span></h1>
      <div className="row">
        {["approved", "hidden", "pending_review"].filter((s) => s !== ev.status).map((s) => (
          <form key={s} action={setStatus}>
            <input type="hidden" name="id" value={ev.id} />
            <input type="hidden" name="status" value={s} />
            <button className="secondary">{s}</button>
          </form>
        ))}
      </div>

      <h2>Headline</h2>
      <form action={editEvent} className="stack" style={{ maxWidth: "100%" }}>
        <input type="hidden" name="id" value={ev.id} />
        <input name="title_en" defaultValue={ev.title_en} required />
        <textarea name="why_en" defaultValue={ev.why_en ?? ""} rows={2} />
        <input name="reason" placeholder="Reason (shown publicly in the corrections log)" />
        <button>Save{ev.title_locked ? "" : " and lock headline"}</button>
      </form>

      <h2>Items</h2>
      <table>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <span className="chip">{i.node_type}</span> <span className="chip">{i.claim_type}</span> {i.source_id}
                <div>{i.summary_en} <a href={i.url} target="_blank" rel="noopener">↗</a></div>
              </td>
              <td>
                <form action={moveItem} className="row">
                  <input type="hidden" name="item_id" value={i.id} />
                  <input name="target" placeholder="event id or new" size={10} required />
                  <button className="secondary">Move</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Merge into another event</h2>
      <form action={mergeEvent} className="row">
        <input type="hidden" name="id" value={ev.id} />
        <input name="into" placeholder="target event id" required />
        <button className="secondary">Merge</button>
      </form>

      <h2>Change log</h2>
      <ul>
        {log.map((c, n) => (
          <li key={n} className="meta">
            {new Date(c.created_at).toISOString().slice(0, 16)} {c.field}: {c.old_value} → {c.new_value} {c.public ? "(public)" : ""}
          </li>
        ))}
      </ul>
    </>
  );
}
