// Quick health check for a new installation.
//
//   npm run doctor
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { ROOT, dbConfig, uploadDir } from "./env.mjs";

let failures = 0;
const ok = (msg) => console.log(`  [ok]   ${msg}`);
const warn = (msg) => console.log(`  [warn] ${msg}`);
const fail = (msg) => { failures += 1; console.log(`  [FAIL] ${msg}`); };

console.log("\nYasmeen World - installation check\n");

const major = Number(process.versions.node.split(".")[0]);
major >= 20 ? ok(`Node.js ${process.version}`) : fail(`Node.js ${process.version} is too old (need 20.9 or newer)`);

fs.existsSync(path.join(ROOT, ".env.local")) ? ok(".env.local found") : warn(".env.local not found - copy .env.example to .env.local and edit it");

try {
  const sharp = (await import("sharp")).default;
  await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).webp().toBuffer();
  ok("sharp (image processing) works");
} catch (err) {
  fail(`sharp could not run: ${err.message}`);
}

const dir = uploadDir();
try {
  fs.mkdirSync(dir, { recursive: true });
  fs.accessSync(dir, fs.constants.W_OK);
  ok(`upload folder is writable (${dir})`);
} catch {
  fail(`upload folder is not writable: ${dir}`);
}

const cfg = dbConfig();
let conn;
try {
  conn = await mysql.createConnection(cfg);
  ok(`connected to MySQL "${cfg.database}" at ${cfg.host}:${cfg.port}`);
} catch (err) {
  fail(`cannot connect to MySQL "${cfg.database}": ${err.message}`);
  console.log("        Start MySQL (XAMPP control panel) and run  npm run db:setup");
}

if (conn) {
  try {
    const [tables] = await conn.query("SHOW TABLES");
    const names = new Set(tables.map((t) => Object.values(t)[0]));
    const needed = ["admins", "products", "orders", "settings", "gift_bases", "cities", "categories"];
    const missing = needed.filter((n) => !names.has(n));
    missing.length ? fail(`missing tables (${missing.join(", ")}) - run  npm run db:setup`) : ok(`database tables present (${names.size})`);

    if (!missing.includes("admins")) {
      const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM admins WHERE is_active = 1");
      n > 0 ? ok(`${n} admin account(s)`) : warn("no admin account yet - run  npm run admin:create");
    }
    if (!missing.includes("cities")) {
      const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM cities WHERE is_active = 1");
      n > 0 ? ok(`${n} delivery cities`) : warn("no active delivery cities - customers cannot check out");
    }
    if (!missing.includes("settings")) {
      const [rows] = await conn.query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('contact_phone','whatsapp_number','instagram_url')");
      const empty = rows.filter((r) => !r.setting_value).map((r) => r.setting_key);
      empty.length ? warn(`not filled in yet (Admin > Store settings): ${empty.join(", ")}`) : ok("contact details filled in");
    }
  } catch (err) {
    fail(`database check failed: ${err.message}`);
  } finally {
    await conn.end();
  }
}

// (dbConfig() above already loaded .env.local into process.env)
process.env.SMTP_HOST
  ? ok("SMTP email is configured")
  : warn("SMTP email is not configured - orders work, but no confirmation emails or password-reset emails are sent");

console.log(failures ? `\n${failures} problem(s) found.\n` : "\nEverything needed is in place.\n");
process.exit(failures ? 1 : 0);
