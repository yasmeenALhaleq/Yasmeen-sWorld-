import "server-only";
import { cache } from "react";
import { cached } from "@/server/cache";
import { query, queryOne } from "@/server/db/pool";
import { stripHtml } from "@/lib/html";
import { resolvePrice, type DiscountRule } from "@/lib/pricing";
import type {
  ImageRef, NamedRef, ProductCardData, ProductDetailData, ProductVariantData,
} from "@/lib/types";

const CATALOG_TTL_MS = 15_000;
const TAXONOMY_TTL_MS = 30_000;

// ------------------------------------------------------------------ rules

interface DiscountRow {
  id: number; name: string; scope: DiscountRule["scope"]; product_id: number | null; category_id: number | null;
  type: DiscountRule["type"]; value: number; starts_at: Date | null; ends_at: Date | null; is_active: number;
}

/** Discount rules that are switched on (date windows are checked at price time). */
export async function getDiscountRules(): Promise<DiscountRule[]> {
  return cached("discount-rules", TAXONOMY_TTL_MS, async () => {
    const rows = await query<DiscountRow>(
      "SELECT id, name, scope, product_id, category_id, type, value, starts_at, ends_at, is_active FROM discounts WHERE is_active = 1",
    );
    return rows.map((r) => ({
      id: r.id, name: r.name, scope: r.scope, productId: r.product_id, categoryId: r.category_id,
      type: r.type, value: Number(r.value), startsAt: r.starts_at, endsAt: r.ends_at, isActive: r.is_active === 1,
    }));
  });
}

// --------------------------------------------------------------- taxonomy

export interface CategoryInfo extends NamedRef { description: string; imageKey: string | null; isGift: boolean }
export interface Taxonomy {
  categories: CategoryInfo[];
  occasions: (NamedRef & { imageKey: string | null; inBuilder: boolean })[];
  scents: NamedRef[];
}

export const getTaxonomy = cache((): Promise<Taxonomy> =>
  cached("taxonomy", TAXONOMY_TTL_MS, async () => {
    const [categories, occasions, scents] = await Promise.all([
      query<{ id: number; slug: string; name: string; description: string | null; image_key: string | null; is_gift: number }>(
        "SELECT id, slug, name, description, image_key, is_gift FROM categories WHERE is_active = 1 ORDER BY sort_order, name",
      ),
      query<{ id: number; slug: string; name: string; image_key: string | null; in_builder: number }>(
        "SELECT id, slug, name, image_key, in_builder FROM occasions WHERE is_active = 1 ORDER BY sort_order, name",
      ),
      query<NamedRef>("SELECT id, slug, name FROM scents WHERE is_active = 1 ORDER BY sort_order, name"),
    ]);
    return {
      categories: categories.map((c) => ({
        id: c.id, slug: c.slug, name: c.name, description: c.description ?? "", imageKey: c.image_key, isGift: c.is_gift === 1,
      })),
      occasions: occasions.map((o) => ({ id: o.id, slug: o.slug, name: o.name, imageKey: o.image_key, inBuilder: o.in_builder === 1 })),
      scents,
    };
  }),
);

// ---------------------------------------------------------------- catalog

interface ProductRow {
  id: number; slug: string; name: string; short_description: string | null; ingredients: string | null; option_name: string | null;
  category_id: number | null; category_slug: string | null; category_name: string | null; category_is_gift: number | null;
  scent_id: number | null; price: number; track_stock: number; stock_quantity: number; low_stock_threshold: number;
  is_featured: number; in_builder: number; sold_count: number; created_at: Date;
}

interface VariantRow {
  id: number; product_id: number; label: string; scent_id: number | null; price_delta: number; stock_quantity: number;
}

/** Internal catalogue entry: the public card plus fields used only for search/filtering. */
interface CatalogEntry {
  card: ProductCardData;
  search: string;
  isGiftCategory: boolean;
}

function buildVariantData(
  p: ProductRow,
  variants: VariantRow[],
  rules: DiscountRule[],
  now: Date,
): ProductVariantData[] {
  return variants.map((v) => {
    const price = resolvePrice(p.price + Number(v.price_delta), { id: p.id, categoryId: p.category_id }, rules, now);
    return {
      id: v.id, label: v.label, scentId: v.scent_id, price: price.original, finalPrice: price.final, percentOff: price.percentOff,
      stock: p.track_stock === 1 ? Math.max(v.stock_quantity, 0) : null,
      inStock: p.track_stock === 0 || v.stock_quantity > 0,
    };
  });
}

function buildCard(
  p: ProductRow,
  variants: VariantRow[],
  image: ImageRef | null,
  occasionIds: number[],
  rules: DiscountRule[],
  now: Date,
): ProductCardData {
  const ref = { id: p.id, categoryId: p.category_id };
  const quickVariants = buildVariantData(p, variants, rules, now);
  const priced = quickVariants.length
    ? quickVariants.map((v) => ({ original: v.price, final: v.finalPrice, percentOff: v.percentOff }))
    : [resolvePrice(p.price, ref, rules, now)];
  const best = priced.reduce((a, b) => (b.final < a.final ? b : a));
  const distinct = new Set(priced.map((x) => x.final));

  let inStock: boolean;
  let totalStock: number | null;
  if (variants.length) {
    inStock = p.track_stock === 0 || variants.some((v) => v.stock_quantity > 0);
    totalStock = p.track_stock === 0 ? null : variants.reduce((s, v) => s + Math.max(v.stock_quantity, 0), 0);
  } else {
    inStock = p.track_stock === 0 || p.stock_quantity > 0;
    totalStock = p.track_stock === 0 ? null : p.stock_quantity;
  }

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.short_description ?? "",
    categoryId: p.category_id,
    categorySlug: p.category_slug,
    categoryName: p.category_name,
    optionName: p.option_name || "Option",
    quickVariants,
    trackStock: p.track_stock === 1,
    stockQuantity: p.stock_quantity,
    lowStockThreshold: p.low_stock_threshold,
    price: best.original,
    finalPrice: best.final,
    percentOff: best.percentOff,
    priceFrom: distinct.size > 1,
    hasVariants: variants.length > 0,
    image,
    inStock,
    lowStock: inStock && totalStock !== null && totalStock <= p.low_stock_threshold,
    isFeatured: p.is_featured === 1,
    inBuilder: p.in_builder === 1,
    soldCount: p.sold_count,
    createdAt: p.created_at.toISOString(),
    occasionIds,
    scentIds: [...new Set([...(p.scent_id ? [p.scent_id] : []), ...variants.flatMap((v) => (v.scent_id ? [v.scent_id] : []))])],
  };
}

async function loadCatalog(): Promise<CatalogEntry[]> {
  const [products, images, occasionLinks, variants, rules, taxonomy] = await Promise.all([
    query<ProductRow>(
      `SELECT p.id, p.slug, p.name, p.short_description, p.ingredients, p.option_name, p.category_id, c.slug AS category_slug,
              c.name AS category_name, c.is_gift AS category_is_gift, p.scent_id, p.price, p.track_stock,
              p.stock_quantity, p.low_stock_threshold, p.is_featured, p.in_builder, p.sold_count, p.created_at
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = 1
        ORDER BY p.created_at DESC, p.id DESC`,
    ),
    query<{ product_id: number; image_key: string; alt: string | null }>(
      "SELECT product_id, image_key, alt FROM product_images ORDER BY product_id, sort_order, id",
    ),
    query<{ product_id: number; occasion_id: number }>("SELECT product_id, occasion_id FROM product_occasions"),
    query<VariantRow>(
      "SELECT id, product_id, label, scent_id, price_delta, stock_quantity FROM product_variants WHERE is_active = 1 ORDER BY product_id, sort_order, id",
    ),
    getDiscountRules(),
    getTaxonomy(),
  ]);

  const firstImage = new Map<number, ImageRef>();
  for (const i of images) if (!firstImage.has(i.product_id)) firstImage.set(i.product_id, { key: i.image_key, alt: i.alt ?? "" });
  const occasionsBy = new Map<number, number[]>();
  for (const l of occasionLinks) occasionsBy.set(l.product_id, [...(occasionsBy.get(l.product_id) ?? []), l.occasion_id]);
  const variantsBy = new Map<number, VariantRow[]>();
  for (const v of variants) variantsBy.set(v.product_id, [...(variantsBy.get(v.product_id) ?? []), v]);

  const nameOf = (list: NamedRef[], ids: number[]) => ids.map((id) => list.find((x) => x.id === id)?.name ?? "").join(" ");
  const now = new Date();

  return products.map((p) => {
    const card = buildCard(p, variantsBy.get(p.id) ?? [], firstImage.get(p.id) ?? null, occasionsBy.get(p.id) ?? [], rules, now);
    if (card.image && !card.image.alt) card.image = { ...card.image, alt: p.name };
    const search = [
      p.name, p.short_description, p.category_name, stripHtml(p.ingredients ?? ""),
      nameOf(taxonomy.occasions, card.occasionIds), nameOf(taxonomy.scents, card.scentIds),
    ].join(" ").toLowerCase();
    return { card, search, isGiftCategory: p.category_is_gift === 1 };
  });
}

const getCatalog = cache((): Promise<CatalogEntry[]> => cached("catalog", CATALOG_TTL_MS, loadCatalog));

/** Every visible product as a card (newest first). */
export async function getAllCards(): Promise<ProductCardData[]> {
  return (await getCatalog()).map((e) => e.card);
}

// ---------------------------------------------------------------- listing

export type SortKey = "newest" | "price_asc" | "price_desc" | "best";

export interface ListParams {
  q?: string;
  category?: string; // slug
  occasion?: string; // slug
  scent?: string; // slug
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  giftsOnly?: boolean;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
}

export interface ListResult {
  items: ProductCardData[];
  total: number;
  page: number;
  pages: number;
  priceBounds: { min: number; max: number };
}

export async function listProducts(params: ListParams): Promise<ListResult> {
  const [entries, taxonomy] = await Promise.all([getCatalog(), getTaxonomy()]);

  const category = params.category ? taxonomy.categories.find((c) => c.slug === params.category) : undefined;
  const occasion = params.occasion ? taxonomy.occasions.find((o) => o.slug === params.occasion) : undefined;
  const scent = params.scent ? taxonomy.scents.find((s) => s.slug === params.scent) : undefined;
  const words = (params.q ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);

  // Facet bounds ignore the price filter itself so the slider range stays stable.
  let pool = entries.filter((e) => {
    const c = e.card;
    if (params.giftsOnly && !e.isGiftCategory) return false;
    if (params.category && c.categoryId !== category?.id) return false;
    if (params.occasion && !(occasion && c.occasionIds.includes(occasion.id))) return false;
    if (params.scent && !(scent && c.scentIds.includes(scent.id))) return false;
    if (params.inStockOnly && !c.inStock) return false;
    if (params.onSaleOnly && c.percentOff === 0) return false;
    if (words.length && !words.every((w) => e.search.includes(w))) return false;
    return true;
  });

  const prices = pool.map((e) => e.card.finalPrice);
  const priceBounds = prices.length
    ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
    : { min: 0, max: 0 };

  pool = pool.filter((e) => {
    if (params.minPrice !== undefined && e.card.finalPrice < params.minPrice) return false;
    if (params.maxPrice !== undefined && e.card.finalPrice > params.maxPrice) return false;
    return true;
  });

  const sorted = [...pool].sort((a, b) => {
    switch (params.sort) {
      case "price_asc": return a.card.finalPrice - b.card.finalPrice || b.card.id - a.card.id;
      case "price_desc": return b.card.finalPrice - a.card.finalPrice || b.card.id - a.card.id;
      case "best": return b.card.soldCount - a.card.soldCount || b.card.id - a.card.id;
      default: return b.card.createdAt.localeCompare(a.card.createdAt) || b.card.id - a.card.id;
    }
  });

  const pageSize = Math.min(Math.max(params.pageSize ?? 12, 1), 60);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(params.page ?? 1, 1), pages);
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize).map((e) => e.card),
    total: sorted.length,
    page,
    pages,
    priceBounds,
  };
}

export async function getFeatured(limit = 8): Promise<ProductCardData[]> {
  return (await getAllCards()).filter((c) => c.isFeatured).slice(0, limit);
}

/** Top sellers by units sold. Products that never sold are not "best sellers". */
export async function getBestSellers(limit = 8): Promise<ProductCardData[]> {
  return (await getAllCards())
    .filter((c) => c.soldCount > 0)
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, limit);
}

export async function getReadyGifts(limit = 8): Promise<ProductCardData[]> {
  const gifts = (await getCatalog()).filter((e) => e.isGiftCategory).map((e) => e.card);
  return [...gifts.filter((c) => c.isFeatured), ...gifts.filter((c) => !c.isFeatured)].slice(0, limit);
}

export async function getRelated(product: ProductCardData, limit = 4): Promise<ProductCardData[]> {
  const others = (await getAllCards()).filter((c) => c.id !== product.id);
  const score = (c: ProductCardData) =>
    (c.categoryId !== null && c.categoryId === product.categoryId ? 2 : 0) +
    c.occasionIds.filter((o) => product.occasionIds.includes(o)).length;
  return others
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.soldCount - a.c.soldCount)
    .slice(0, limit)
    .map((x) => x.c);
}

/** Visible product count per category, for the category cards. */
export async function getCategoryCounts(): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  for (const c of await getAllCards()) {
    if (c.categoryId !== null) counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1);
  }
  return counts;
}

// ----------------------------------------------------------------- detail

/** Full product page data. Always read live so stock is accurate. */
export async function getProductBySlug(slug: string): Promise<ProductDetailData | null> {
  const p = await queryOne<ProductRow & {
    description: string | null; how_to_use: string | null; size_label: string | null; option_name: string | null;
    meta_title: string | null; meta_description: string | null; scent_name: string | null;
  }>(
    `SELECT p.id, p.slug, p.name, p.short_description, p.description, p.ingredients, p.how_to_use, p.size_label,
            p.option_name, p.meta_title, p.meta_description, p.category_id, c.slug AS category_slug,
            c.name AS category_name, c.is_gift AS category_is_gift, p.scent_id, s.name AS scent_name, p.price,
            p.track_stock, p.stock_quantity, p.low_stock_threshold, p.is_featured, p.in_builder, p.sold_count, p.created_at
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN scents s ON s.id = p.scent_id
      WHERE p.slug = ? AND p.is_active = 1`,
    [slug],
  );
  if (!p) return null;

  const [images, occasions, variantRows, rules] = await Promise.all([
    query<{ image_key: string; alt: string | null }>(
      "SELECT image_key, alt FROM product_images WHERE product_id = ? ORDER BY sort_order, id",
      [p.id],
    ),
    query<NamedRef>(
      `SELECT o.id, o.slug, o.name FROM product_occasions po JOIN occasions o ON o.id = po.occasion_id
        WHERE po.product_id = ? AND o.is_active = 1 ORDER BY o.sort_order, o.name`,
      [p.id],
    ),
    query<VariantRow>(
      "SELECT id, product_id, label, scent_id, price_delta, stock_quantity FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY sort_order, id",
      [p.id],
    ),
    getDiscountRules(),
  ]);

  const now = new Date();
  const imageRefs: ImageRef[] = images.map((i) => ({ key: i.image_key, alt: i.alt || p.name }));
  const card = buildCard(p, variantRows, imageRefs[0] ?? null, [], rules, now);

  const variants = buildVariantData(p, variantRows, rules, now);

  return {
    ...card,
    occasionIds: occasions.map((o) => o.id),
    description: p.description ?? "",
    ingredients: p.ingredients ?? "",
    howToUse: p.how_to_use ?? "",
    sizeLabel: p.size_label ?? "",
    optionName: p.option_name || "Option",
    images: imageRefs,
    variants,
    occasions,
    scentName: p.scent_name,
    trackStock: p.track_stock === 1,
    stockQuantity: p.stock_quantity,
    lowStockThreshold: p.low_stock_threshold,
    metaTitle: p.meta_title ?? "",
    metaDescription: p.meta_description ?? "",
  };
}
