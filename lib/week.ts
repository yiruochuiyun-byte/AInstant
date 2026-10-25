// ISO weeks (Monday start, UTC), shared by the weekly issue and the topic pages.
const DAY = 864e5;

/** ISO 8601 week of a date (weeks start on Monday, UTC). */
export function isoWeek(d: Date): { week: string; start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  const thursday = new Date(start.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const n = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return { week: `${year}-W${String(n).padStart(2, "0")}`, start, end: new Date(start.getTime() + 7 * DAY) };
}

/** "2026-W43" → that week's bounds, or null when malformed. */
export function parseWeek(week: string): { week: string; start: Date; end: Date } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  // January 4th is always in week 1.
  const w1 = isoWeek(new Date(Date.UTC(Number(m[1]), 0, 4)));
  const w = isoWeek(new Date(w1.start.getTime() + (Number(m[2]) - 1) * 7 * DAY));
  return w.week === week ? w : null;
}
