import { readFileSync } from "node:fs";

/** The only DB surface the pipeline uses: parameterized SQL in, rows out. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/** DATABASE_URL set: real Postgres (Supabase). Otherwise: local PGlite with pgvector, for development and tests. */
export async function connect(opts: { memory?: boolean } = {}): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url && !opts.memory) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
    return {
      query: async (text, params = []) => (await sql.unsafe(text, params as never[])) as never,
      close: () => sql.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  const dataDir = opts.memory ? undefined : process.env.PGLITE_DIR ?? ".pglite";
  const pg = await PGlite.create({ dataDir, extensions: { vector } });
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows as never,
    close: () => pg.close(),
  };
}

/** One shared connection per server process (the website). */
export function getDb(): Promise<Db> {
  const g = globalThis as { __ainstantDb?: Promise<Db> };
  return (g.__ainstantDb ??= connect());
}

export async function migrate(db: Db): Promise<void> {
  const ddl = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  // Split on statement boundaries; the schema has no functions or DO blocks.
  for (const stmt of ddl.split(/;\s*$/m)) {
    const s = stmt.replace(/^\s*--.*$/gm, "").trim();
    if (s) await db.query(s);
  }
}

/** pgvector literal. */
export const vec = (v: number[]) => `[${v.join(",")}]`;
