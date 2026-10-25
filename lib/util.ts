export const log = (...args: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...args);

export const offline = () => process.env.AINSTANT_OFFLINE === "1";

/** Run fn over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const UA = "AInstantBot/0.1 (+https://ainstant.news/bot)";

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "user-agent": UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  return JSON.parse(await fetchText(url, init)) as T;
}

export const clip = (s: string | undefined, n: number) =>
  s ? s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : undefined;
