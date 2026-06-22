import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function resolveDbPath(): string {
  const url = env.databaseUrl || "file:./data/rain.db";
  if (!url.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL must be a SQLite file path (e.g. file:./data/rain.db). MySQL is not configured."
    );
  }
  const relative = url.slice(5);
  return path.isAbsolute(relative) ? relative : path.resolve(appRoot, relative);
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
