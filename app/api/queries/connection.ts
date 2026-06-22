import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

function resolveDbPath(): string {
  const url = env.databaseUrl || "file:./data/rain.db";
  if (!url.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL must be a SQLite file path (e.g. file:./data/rain.db). MySQL is not configured."
    );
  }
  const relative = url.slice(5);
  // Resolve relative paths against the working directory (the `app/` folder for
  // both `vite` dev and `node dist/boot.js` prod) — NOT the bundle's own
  // location, which sits in app/dist/ and resolved one level too high.
  return path.isAbsolute(relative) ? relative : path.resolve(process.cwd(), relative);
}

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const dbPath = resolveDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    instance = drizzle(sqlite, { schema: fullSchema });
  }
  return instance;
}
