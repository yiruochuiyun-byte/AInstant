import { notFound } from "next/navigation";
import { getWeekly } from "../../../../lib/queries.ts";
import { getDb } from "../../../../lib/db.ts";
import { WeeklyView } from "../../../../components/Weekly.tsx";
import { approveWeekly, dropWeeklyStory, editWeeklyIntro, rebuildWeekly, unpublishWeekly } from "../../actions.ts";

export default async function WeeklyAdmin({ params }: PageProps<"/admin/w/[week]">) {
  const { week } = await params;
  const w = await getWeekly("en", week, true);
  if (!w) notFound();
  const [{ intro_en }] = await (await getDb()).query<{ intro_en: string | null }>(`select intro_en from weeklies where week = $1`, [week]);
  const hidden = (
    <input type="hidden" name="week" value={week} />
  );
  return (
    <>
      <h1>Weekly {week} · {w.status}</h1>
      <p className="note">
        Check the overview against the stories (neutral, every claim attributed), drop stories that do not belong, then publish.
        Subscribers get the issue at their next 8:00 local time within 3 days of publishing.
      </p>
      <div className="row">
        {w.status === "draft" ? (
          <>
            <form action={approveWeekly}>{hidden}<button>Publish and send</button></form>
            <form action={rebuildWeekly}>{hidden}<button className="secondary">Rebuild from current data</button></form>
          </>
        ) : (
          <form action={unpublishWeekly}>{hidden}<button className="secondary">Unpublish</button></form>
        )}
        <a href={`/en/w/${week}`}>Public page ↗</a>
      </div>
      <h2>Overview</h2>
      <form action={editWeeklyIntro} className="stack" style={{ maxWidth: "100%" }}>
        {hidden}
        <textarea name="intro_en" rows={4} defaultValue={intro_en ?? ""} placeholder="2-3 neutral sentences on the week" />
        <button>Save overview</button>
      </form>
      <h2>Stories</h2>
      <table>
        <tbody>
          {[...w.top.map((e) => ({ e, top: true })), ...w.more.map((e) => ({ e, top: false }))].map(({ e, top }) => (
            <tr key={e.id}>
              <td>{top ? "Top" : "Also"}</td>
              <td>{e.title}</td>
              <td>
                <form action={dropWeeklyStory}>
                  {hidden}
                  <input type="hidden" name="event_id" value={e.id} />
                  <button className="secondary">Drop</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Preview</h2>
      <div className="card">
        <WeeklyView lang="en" w={w} base="/admin/w" />
      </div>
    </>
  );
}
