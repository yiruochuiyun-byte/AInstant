"use client";
import { useEffect, useState } from "react";

/** Prefilled with the browser's time zone so the digest arrives at 8:00 local time. */
export function TimezoneInput({ label }: { label: string }) {
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);
  return (
    <label>
      {label}
      <br />
      <input name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} />
    </label>
  );
}
