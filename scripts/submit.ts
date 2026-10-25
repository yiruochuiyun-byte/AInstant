// Push one link into the inbox, the same way the Grok bot or the admin will.
// Usage: npm run submit -- <url> "<title>" [lang]
import { connect, migrate } from "../src/lib/db.ts";

const [url, title, lang] = process.argv.slice(2);
if (!url) {
  console.error('usage: npm run submit -- <url> "<title>" [lang]');
  process.exit(1);
}
const db = await connect();
await migrate(db);
await db.query(`insert into inbox (url, title, lang) values ($1, $2, $3)`, [url, title ?? null, lang ?? null]);
console.log("queued", url);
await db.close();
