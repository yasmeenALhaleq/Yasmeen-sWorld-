import "server-only";
import { clearCache } from "@/server/cache";
import { execute, placeholders, query, queryOne, withTransaction } from "@/server/db/pool";
import { deleteImageFiles, isImageKey } from "@/server/services/images";
import { uniqueSlug } from "@/server/slugs";
import { roundMoney } from "@/lib/money";
import { sanitizeDescription } from "@/lib/sanitize";

// ----------------------------------------------------------------- shapes

export interface ProductInput {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  howToUse: string;
  sizeLabel: string;
  categoryId: number | null;
  scentId: number | null;
  optionName: string;
  price: number;
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  isFeatured: boolean;
  inBuilder: boolean;
  metaTitle: string;
  metaDescription: string;
  occasionIds: number[];
  images: { key: string; alt: string }[];
  variants: { id: number | null; label: string; scentId: number | null; priceDelta: number; stockQuantity: number; isActive: boolean }[];
}

export interface AdminProduct extends ProductInput {
  id: number;
  soldCount: number;
  isDemo: boolean;
}

export interface AdminProductRow {
  id: number;
  name: string;
  slug: string;
  price: number;
  categoryName: string | null;
  stock: number | null;
  isActive: boolean;
  isFeatured: boolean;
  inBuilder: boolean;
  soldCount: number;
  imageKey: string | null;
  isDemo: boolean;
}

// ----------------------------------------------------------------- reading

export interface AdminProductListParams {
  q?: string;
  categoryId?: number;
  status?: "active" | "hidden" | "low" | "out";
  page?: number;
  pageSize?: number;
}

export async function listAdminProducts(params: AdminProductListParams) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.q?.trim()) {
    where.push("(p.name LIKE ? OR p.slug LIKE ?)");
    const like = `%${params.q.trim().replace(/[%_\\]/g, "\\$&")}%`;
    args.push(like, like);
  }
  if (params.categoryId) { where.push("p.category_id = ?"); args.push(params.categoryId); }
  if (params.status === "active") where.push("p.is_active = 1");
  if (params.status === "hidden") where.push("p.is_active = 0");
  if (params.status === "out") where.push("p.track_stock = 1 AND stock_total <= 0");
  if (params.status === "low") where.push("p.track_stock = 1 AND stock_total > 0 AND stock_total <= p.low_stock_threshold");

  // stock_total: sum of variant stock when the product has variants, else its own stock.
  const base = `FROM (
      SELECT p.*, CASE WHEN EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
                       THEN (SELECT COALESCE(SUM(v.stock_quantity), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
                       ELSE p.stock_quantity END AS stock_total
        FROM products p) p
      LEFT JOIN categories c ON c.id = p.category_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;

  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, args))?.n ?? 0;
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(params.page ?? 1, 1), pages);

  const rows = await query<{
    id: number; name: string; slug: string; price: number; category_name: string | null; track_stock: number; stock_total: number;
    is_active: number; is_featured: number; in_builder: number; sold_count: number; image_key: string | null; is_demo: number;
  }>(
    `SELECT p.id, p.name, p.slug, p.price, c.name AS category_name, p.track_stock, p.stock_total, p.is_active, p.is_featured,
            p.in_builder, p.sold_count, p.is_demo,
            (SELECT image_key FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image_key
       ${base} ORDER BY p.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    args,
  );
  const items: AdminProductRow[] = rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, price: Number(r.price), categoryName: r.category_name,
    stock: r.track_stock === 1 ? r.stock_total : null, isActive: r.is_active === 1, isFeatured: r.is_featured === 1,
    inBuilder: r.in_builder === 1, soldCount: r.sold_count, imageKey: r.image_key, isDemo: r.is_demo === 1,
  }));
  return { items, total, page, pages };
}

export async function getAdminProduct(id: number): Promise<AdminProduct | null> {
  const p = await queryOne<{
    id: number; slug: string; name: string; short_description: string | null; description: string | null; ingredients: string | null;
    how_to_use: string | null; size_label: string | null; category_id: number | null; scent_id: number | null; option_name: string | null;
    price: number; track_stock: number; stock_quantity: number; low_stock_threshold: number; is_active: number; is_featured: number;
    in_builder: number; sold_count: number; meta_title: string | null; meta_description: string | null; is_demo: number;
  }>("SELECT * FROM products WHERE id = ?", [id]);
  if (!p) return null;

  const [images, occasions, variants] = await Promise.all([
    query<{ image_key: string; alt: string | null }>("SELECT image_key, alt FROM product_images WHERE product_id = ? ORDER BY sort_order, id", [id]),
    query<{ occasion_id: number }>("SELECT occasion_id FROM product_occasions WHERE product_id = ?", [id]),
    query<{ id: number; label: string; scent_id: number | null; price_delta: number; stock_quantity: number; is_active: number }>(
      "SELECT id, label, scent_id, price_delta, stock_quantity, is_active FROM product_variants WHERE product_id = ? ORDER BY sort_order, id", [id]),
  ]);

  return {
    id: p.id, slug: p.slug, name: p.name, shortDescription: p.short_description ?? "", description: p.description ?? "",
    ingredients: p.ingredients ?? "", howToUse: p.how_to_use ?? "", sizeLabel: p.size_label ?? "", categoryId: p.category_id,
    scentId: p.scent_id, optionName: p.option_name ?? "", price: Number(p.price), trackStock: p.track_stock === 1,
    stockQuantity: p.stock_quantity, lowStockThreshold: p.low_stock_threshold, isActive: p.is_active === 1,
    isFeatured: p.is_featured === 1, inBuilder: p.in_builder === 1, metaTitle: p.meta_title ?? "", metaDescription: p.meta_description ?? "",
    occasionIds: occasions.map((o) => o.occasion_id),
    images: images.map((i) => ({ key: i.image_key, alt: i.alt ?? "" })),
    variants: variants.map((v) => ({
      id: v.id, label: v.label, scentId: v.scent_id, priceDelta: Number(v.price_delta), stockQuantity: v.stock_quantity, isActive: v.is_active === 1,
    })),
    soldCount: p.sold_count, isDemo: p.is_demo === 1,
  };
}

// ----------------------------------------------------------------- writing

export async function saveProduct(input: ProductInput, id: number | null): Promise<number> {
  const description = sanitizeDescription(input.description);
  const images = input.images.filter((i) => isImageKey(i.key)).slice(0, 12);

  const productId = await withTransaction(async (tx) => {
    const slug = await uniqueSlug("products", input.slug || input.name, id, tx);
    const values = [
      slug, input.name, input.shortDescription || null, description || null, input.ingredients || null, input.howToUse || null,
      input.sizeLabel || null, input.categoryId, input.scentId, input.optionName || null, roundMoney(input.price),
      input.trackStock ? 1 : 0, Math.max(0, Math.trunc(input.stockQuantity)), Math.max(0, Math.trunc(input.lowStockThreshold)),
      input.isActive ? 1 : 0, input.isFeatured ? 1 : 0, input.inBuilder ? 1 : 0, input.metaTitle || null, input.metaDescription || null,
    ];
    let pid = id;
    if (id) {
      await execute(
        `UPDATE products SET slug=?, name=?, short_description=?, description=?, ingredients=?, how_to_use=?, size_label=?, category_id=?,
                scent_id=?, option_name=?, price=?, track_stock=?, stock_quantity=?, low_stock_threshold=?, is_active=?, is_featured=?,
                in_builder=?, meta_title=?, meta_description=? WHERE id=?`,
        [...values, id], tx);
    } else {
      const res = await execute(
        `INSERT INTO products (slug, name, short_description, description, ingredients, how_to_use, size_label, category_id, scent_id,
                option_name, price, track_stock, stock_quantity, low_stock_threshold, is_active, is_featured, in_builder, meta_title, meta_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values, tx);
      pid = res.insertId;
    }

    // Occasions: replace.
    await execute("DELETE FROM product_occasions WHERE product_id = ?", [pid], tx);
    for (const oid of [...new Set(input.occasionIds)]) {
      await execute("INSERT INTO product_occasions (product_id, occasion_id) VALUES (?, ?)", [pid, oid], tx);
    }

    // Images: replace, keeping the submitted order (first = main image).
    await execute("DELETE FROM product_images WHERE product_id = ?", [pid], tx);
    for (const [i, img] of images.entries()) {
      await execute("INSERT INTO product_images (product_id, image_key, alt, sort_order) VALUES (?, ?, ?, ?)", [pid, img.key, img.alt.slice(0, 200) || null, i], tx);
    }

    // Variants: update the ones that still exist, add new ones, drop the rest.
    const existing = await query<{ id: number }>("SELECT id FROM product_variants WHERE product_id = ?", [pid], tx);
    const keep = new Set<number>();
    for (const [i, v] of input.variants.entries()) {
      const params = [v.label, v.scentId, roundMoney(v.priceDelta), Math.max(0, Math.trunc(v.stockQuantity)), v.isActive ? 1 : 0, i];
      if (v.id && existing.some((e) => e.id === v.id)) {
        await execute("UPDATE product_variants SET label=?, scent_id=?, price_delta=?, stock_quantity=?, is_active=?, sort_order=? WHERE id=? AND product_id=?", [...params, v.id, pid], tx);
        keep.add(v.id);
      } else {
        const res = await execute(
          "INSERT INTO product_variants (label, scent_id, price_delta, stock_quantity, is_active, sort_order, product_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [...params, pid], tx);
        keep.add(res.insertId);
      }
    }
    const drop = existing.map((e) => e.id).filter((x) => !keep.has(x));
    if (drop.length) await execute(`DELETE FROM product_variants WHERE id IN (${placeholders(drop.length)})`, drop, tx);
    return pid as number;
  });

  clearCache();
  return productId;
}

export async function duplicateProduct(id: number): Promise<number | null> {
  const source = await getAdminProduct(id);
  if (!source) return null;
  return saveProduct(
    {
      ...source,
      name: `${source.name} (copy)`,
      slug: "",
      isActive: false, // a copy starts hidden until it has been reviewed
      variants: source.variants.map((v) => ({ ...v, id: null })),
    },
    null,
  );
}

export async function setProductFlag(id: number, flag: "is_active" | "is_featured" | "in_builder", value: boolean): Promise<void> {
  if (!["is_active", "is_featured", "in_builder"].includes(flag)) throw new Error("Invalid flag");
  await execute(`UPDATE products SET ${flag} = ? WHERE id = ?`, [value ? 1 : 0, id]);
  clearCache();
}

export async function deleteProduct(id: number): Promise<void> {
  const keys = (await query<{ image_key: string }>("SELECT image_key FROM product_images WHERE product_id = ?", [id])).map((r) => r.image_key);
  await execute("DELETE FROM products WHERE id = ?", [id]); // images, variants, discounts cascade
  await purgeUnreferencedImages(keys);
  clearCache();
}

// ------------------------------------------------------------------ images

/** Tables / columns that can reference an uploaded image key. */
const IMAGE_REFERENCES: [string, string][] = [
  ["product_images", "image_key"], ["order_items", "image_key"], ["banners", "image_key"], ["categories", "image_key"],
  ["occasions", "image_key"], ["gift_bases", "image_key"], ["gift_options", "image_key"],
];

/** Deletes the files of uploaded images that nothing references any more. */
export async function purgeUnreferencedImages(keys: (string | null | undefined)[]): Promise<void> {
  for (const key of [...new Set(keys)].filter(isImageKey)) {
    let used = false;
    for (const [table, column] of IMAGE_REFERENCES) {
      if (await queryOne(`SELECT 1 AS x FROM ${table} WHERE ${column} = ? LIMIT 1`, [key])) { used = true; break; }
    }
    if (!used && (await queryOne("SELECT 1 AS x FROM settings WHERE setting_key = 'logo_key' AND setting_value = ?", [key]))) used = true;
    if (!used) await deleteImageFiles(key);
  }
}
