// Finds uploaded images that no product / banner / category ... uses any more
// (for example pictures uploaded and then abandoned before saving) and
// optionally deletes them.
//
//   npm run uploads:cleanup              lists unused files (dry run)
//   npm run uploads:cleanup -- --delete  deletes them
//
// Only files older than 24 hours are touched, so pictures that are being
// uploaded right now are never removed.
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { dbConfig, uploadDir } from "./env.mjs";

const shouldDelete = process.argv.includes("--delete");
const dir = uploadDir();
if (!fs.existsSync(dir)) {
  console.log(`No upload folder yet (${dir}). Nothing to do.`);
  process.exit(0);
}

const conn = await mysql.createConnection(dbConfig());
try {
  const used = new Set();
  const sources = [
    "SELECT image_key AS k FROM product_images", "SELECT image_key AS k FROM order_items", "SELECT image_key AS k FROM banners",
    "SELECT image_key AS k FROM categories", "SELECT image_key AS k FROM occasions", "SELECT image_key AS k FROM gift_bases",
    "SELECT image_key AS k FROM gift_options", "SELECT setting_value AS k FROM settings WHERE setting_key = 'logo_key'",
  ];
  for (const sql of sources) {
    const [rows] = await conn.query(sql);
    for (const r of rows) if (r.k) used.add(r.k);
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let count = 0;
  let bytes = 0;
  for (const file of fs.readdirSync(dir)) {
    const match = file.match(/^([a-f0-9]{24})-(?:400|800|1600|logo|icon)\.(?:webp|png)$/);
    if (!match || used.has(match[1])) continue;
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.mtimeMs > cutoff) continue;
    count += 1;
    bytes += stat.size;
    if (shouldDelete) fs.rmSync(full, { force: true });
    else console.log(`unused: ${file}`);
  }
  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(shouldDelete ? `Deleted ${count} unused files (${mb} MB).` : `${count} unused files (${mb} MB). Run with --delete to remove them.`);
} finally {
  await conn.end();
}
