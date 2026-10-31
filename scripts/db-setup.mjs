// Creates the database (if missing), applies database/schema.sql and
// database/seed.sql. Safe to run any number of times.
//
//   npm run db:setup
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { ROOT, dbConfig } from "./env.mjs";

const cfg = dbConfig();

if (!/^[A-Za-z0-9_]+$/.test(cfg.database)) {
  console.error(`Invalid DB_NAME "${cfg.database}". Use letters, digits and underscores only.`);
  process.exit(1);
}

let conn;
try {
  conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    multipleStatements: true,
    charset: "utf8mb4",
  });
} catch (err) {
  console.error(`Could not connect to MySQL at ${cfg.host}:${cfg.port} as "${cfg.user}".`);
  console.error(`  ${err.message}`);
  console.error("Is MySQL running (XAMPP control panel -> MySQL -> Start)? Check DB_* in .env.local.");
  process.exit(1);
}

try {
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.query(`USE \`${cfg.database}\``);
  await conn.query("SET time_zone = '+00:00'");

  for (const file of ["schema.sql", "seed.sql"]) {
    const sql = fs.readFileSync(path.join(ROOT, "database", file), "utf8");
    await conn.query(sql);
    console.log(`Applied database/${file}`);
  }

  const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM admins");
  console.log(`\nDatabase "${cfg.database}" is ready.`);
  if (n === 0) {
    console.log("Next step: create the first admin account with  npm run admin:create");
  }
} catch (err) {
  console.error("Database setup failed:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
