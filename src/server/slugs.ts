import "server-only";
import { queryOne, type Tx } from "@/server/db/pool";
import { slugify } from "@/lib/slug";

/** Tables that have a unique `slug` column (guards the dynamic SQL below). */
const SLUG_TABLES = new Set(["products", "categories", "occasions", "scents"]);

/** Returns `base`, or `base-2`, `base-3` ... the first slug not used by another row. */
export async function uniqueSlug(table: string, text: string, excludeId: number | null = null, conn?: Tx): Promise<string> {
  if (!SLUG_TABLES.has(table)) throw new Error(`Unsupported slug table: ${table}`);
  const base = slugify(text);
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const row = await queryOne<{ id: number }>(`SELECT id FROM ${table} WHERE slug = ? AND id <> ? LIMIT 1`, [candidate, excludeId ?? 0], conn);
    if (!row) return candidate;
  }
  return `${base}-${Date.now()}`;
}
