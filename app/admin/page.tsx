import Link from "next/link";
import { getDb } from "../../lib/db.ts";
import { setStatus, togglePin, submitLink } from "./actions.ts";

interface Row {
  id: number;
  slug: string | null;
  title_en: string;
  status: string;
  hotness: number;
  item_count: number;
  source_count: number;
  has_controversy: boolean;
  pinned: boolean;
  last_item_at: Date;
}

function Actions({ e }: { e: Row }) {
  const btn = (status: string, label: string) => (
    <form action={setStatus}>
      <input type="hidden" name="id" value={e.id} />
      <input type="hidden" name="status" value={status} />
      <button className={status === "approved" ? undefined : "secondary"}>{label}</button>
    </form>
  );
  return (
    <div className="row">
      {e.status !== "approved" && btn("approved", "Approve")}
      {e.status !== "hidden" && btn("hidden", "Hide")}
      {e.status === "hidden" && btn("auto", "Unhide")}
      <form action={togglePin}>
        <input type="hidden" name="id" value={e.id} />
        <button className="secondary">{e.pinned ? "Unpin" : "Pin"}</button>
      </form>
      <Link href={`/admin/e/${e.id}`}>Edit</Link>
    </div>
  );
}

function Table({ rows }: { rows: Row[] }) {
  return (
    <table>
      <thead>
        <tr><th>Heat</th><th>Event</th><th>Items</th><th></th></tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id}>
            <td>{e.hotness.toFixed(1)}{e.pinned ? " 📌" : ""}</td>
            <td>
              {e.has_controversy && <span className="chip disputed">disputed</span>} <strong>{e.title_en}</strong>
              <div className="meta">#{e.id} · {e.status} · {new Date(e.last_item_at).toISOString().slice(0, 16).replace("T", " ")} UTC</div>
            </td>
            <td>{e.item_count} / {e.source_count} src</td>
            <td><Actions e={e} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const view = (await searchParams).view ?? "queue";
  const db = await getDb();
  const cols = `id, slug, title_en, status, hotness, item_count, source_count, has_controversy, pinned, last_item_at`;

  if (view === "sources") {
    const sources = await db.query<{ id: string; name: string; enabled: boolean; last_fetched_at: Date | null; last_error: string | null; items: string }>(
      `select s.id, s.name, s.enabled, s.last_fetched_at, s.last_error, (select count(*) from items i where i.source_id = s.id) as items from sources s order by s.last_error nulls last, s.id`,
    );
    const runs = await db.query<{ started_at: Date; stats: unknown }>(`select started_at, stats from runs order by id desc limit 5`);
    return (
      <>
        <h1>Sources</h1>
        <table>
          <thead><tr><th>Source</th><th>Items</th><th>Last fetch</th><th>Error</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.name}{s.enabled ? "" : " (off)"}</td>
                <td>{s.items}</td>
                <td>{s.last_fetched_at ? new Date(s.last_fetched_at).toISOString().slice(0, 16) : "never"}</td>
                <td className="up">{s.last_error}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Recent runs</h2>
        {runs.map((r, i) => <pre key={i} style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{new Date(r.started_at).toISOString()} {JSON.stringify(r.stats)}</pre>)}
      </>
    );
  }

  if (view === "live") {
    const live = await db.query<Row>(`select ${cols} from events where status in ('auto', 'approved') order by pinned desc, hotness desc limit 50`);
    return (
      <>
        <h1>Live on the front page</h1>
        <Table rows={live} />
      </>
    );
  }

  const queue = await db.query<Row>(`select ${cols} from events where status = 'pending_review' order by hotness desc`);
  return (
    <>
      <h1>Review queue ({queue.length})</h1>
      <p className="note">Disputed stories wait here. Check that every claim is attributed and labelled, edit the headline if needed, then approve.</p>
      <Table rows={queue} />
      <h2>Submit a link</h2>
      <form action={submitLink} className="stack">
        <input name="url" placeholder="https://..." required />
        <input name="title" placeholder="Title (optional)" />
        <input name="note" placeholder="Note (optional)" />
        <input name="lang" placeholder="Language, e.g. zh (optional)" />
        <button>Add to inbox</button>
      </form>
    </>
  );
}
