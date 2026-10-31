// Tiny .env loader shared by the maintenance scripts (Next.js loads .env.local
// itself for the app, but plain `node scripts/...` does not).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m || line.trim().startsWith("#")) continue;
      let value = m[2];
      if (/^".*"$|^'.*'$/.test(value)) value = value.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  }
}

export function dbConfig() {
  loadEnv();
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "yasmeenworld",
  };
}

export function uploadDir() {
  loadEnv();
  const dir = process.env.UPLOAD_DIR || "./storage/uploads";
  return path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
}
