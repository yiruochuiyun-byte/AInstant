import { log } from "./util.ts";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
}

const FROM = process.env.EMAIL_FROM ?? "AInstant <digest@ainstant.news>";

/** Send through Resend. Without RESEND_API_KEY, log instead (dev / dry run). */
export async function sendEmail(e: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    log(`[email dry-run] to=${e.to} subject=${e.subject}\n${e.text}`);
    return;
  }
  const headers: Record<string, string> = {};
  if (e.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${e.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: e.to, subject: e.subject, html: e.html, text: e.text, headers }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
