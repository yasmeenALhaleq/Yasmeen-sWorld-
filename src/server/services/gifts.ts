import "server-only";
import { cached } from "@/server/cache";
import { query, placeholders } from "@/server/db/pool";
import { getAllCards, getDiscountRules, getTaxonomy } from "@/server/services/catalog";
import { resolvePrice } from "@/lib/pricing";
import type { BuilderBase, BuilderData, BuilderOption, BuilderProduct, GiftBaseType } from "@/lib/types";

// Everything the "Build Your Own Gift" page needs. The owner controls what
// shows up: active bases / sizes / options, occasions with "in builder" on and
// products with "available in the gift builder" on.

export async function getBuilderData(): Promise<BuilderData> {
  const [taxonomy, cards, rules] = await Promise.all([getTaxonomy(), getAllCards(), getDiscountRules()]);

  const [bases, sizes, options] = await Promise.all([
    query<{ id: number; name: string; type: GiftBaseType; description: string | null; image_key: string | null }>(
      "SELECT id, name, type, description, image_key FROM gift_bases WHERE is_active = 1 ORDER BY sort_order, id",
    ),
    query<{ id: number; base_id: number; name: string; price: number; max_items: number }>(
      "SELECT id, base_id, name, price, max_items FROM gift_base_sizes WHERE is_active = 1 ORDER BY sort_order, price, id",
    ),
    query<{ id: number; type: "wrapping" | "ribbon"; name: string; color_hex: string | null; price: number }>(
      "SELECT id, type, name, color_hex, price FROM gift_options WHERE is_active = 1 ORDER BY sort_order, id",
    ),
  ]);

  const builderCards = cards.filter((c) => c.inBuilder);
  const ids = builderCards.map((c) => c.id);

  // Live stock + variants for the eligible products.
  const [stockRows, variantRows] = ids.length
    ? await Promise.all([
        query<{ id: number; option_name: string | null; price: number; category_id: number | null; track_stock: number; stock_quantity: number }>(
          `SELECT id, option_name, price, category_id, track_stock, stock_quantity FROM products WHERE id IN (${placeholders(ids.length)})`, ids),
        query<{ id: number; product_id: number; label: string; price_delta: number; stock_quantity: number }>(
          `SELECT id, product_id, label, price_delta, stock_quantity FROM product_variants
            WHERE is_active = 1 AND product_id IN (${placeholders(ids.length)}) ORDER BY product_id, sort_order, id`, ids),
      ])
    : [[], []];

  const now = new Date();
  const products: BuilderProduct[] = builderCards.flatMap((card) => {
    const row = stockRows.find((r) => r.id === card.id);
    if (!row) return [];
    const vs = variantRows.filter((v) => v.product_id === card.id);
    const tracked = row.track_stock === 1;
    const variants = vs.map((v) => {
      const r = resolvePrice(Number(row.price) + Number(v.price_delta), { id: card.id, categoryId: row.category_id }, rules, now);
      return {
        id: v.id, label: v.label, price: r.original, finalPrice: r.final,
        inStock: !tracked || v.stock_quantity > 0, stock: tracked ? Math.max(v.stock_quantity, 0) : null,
      };
    });
    return [{
      ...card,
      optionName: row.option_name || "Option",
      variants,
      stock: vs.length ? null : tracked ? Math.max(row.stock_quantity, 0) : null,
    }];
  });

  const basesWithSizes: BuilderBase[] = bases
    .map((b) => ({
      id: b.id, name: b.name, type: b.type, description: b.description ?? "",
      image: b.image_key ? { key: b.image_key, alt: b.name } : null,
      sizes: sizes.filter((s) => s.base_id === b.id).map((s) => ({ id: s.id, name: s.name, price: Number(s.price), maxItems: s.max_items })),
    }))
    .filter((b) => b.sizes.length > 0);

  const toOption = (o: (typeof options)[number]): BuilderOption => ({ id: o.id, name: o.name, color: o.color_hex, price: Number(o.price) });
  const usedCategoryIds = new Set(products.map((p) => p.categoryId));

  return {
    occasions: taxonomy.occasions.filter((o) => o.inBuilder).map(({ id, slug, name }) => ({ id, slug, name })),
    bases: basesWithSizes,
    wrappings: options.filter((o) => o.type === "wrapping").map(toOption),
    ribbons: options.filter((o) => o.type === "ribbon").map(toOption),
    products,
    categories: taxonomy.categories.filter((c) => usedCategoryIds.has(c.id)).map((c) => ({ id: c.id, name: c.name })),
  };
}

export interface HomeBanner { id: number; title: string; subtitle: string; buttonText: string; buttonUrl: string; imageKey: string | null }
export interface Testimonial { id: number; authorName: string; location: string; quote: string; rating: number }

/** Banners and testimonials shown on the home page. */
export async function getHomeContent() {
  return cached("home-content", 30_000, async () => {
    const [banners, testimonials] = await Promise.all([
      query<{ id: number; title: string; subtitle: string | null; button_text: string | null; button_url: string | null; image_key: string | null }>(
        "SELECT id, title, subtitle, button_text, button_url, image_key FROM banners WHERE is_active = 1 AND is_demo = 0 ORDER BY sort_order, id",
      ),
      query<{ id: number; author_name: string; location: string | null; quote: string; rating: number }>(
        "SELECT id, author_name, location, quote, rating FROM testimonials WHERE is_active = 1 AND is_demo = 0 ORDER BY sort_order, id LIMIT 9",
      ),
    ]);
    return {
      banners: banners.map((b): HomeBanner => ({
        id: b.id, title: b.title, subtitle: b.subtitle ?? "", buttonText: b.button_text ?? "", buttonUrl: b.button_url ?? "", imageKey: b.image_key,
      })),
      testimonials: testimonials.map((x): Testimonial => ({
        id: x.id, authorName: x.author_name, location: x.location ?? "", quote: x.quote, rating: x.rating,
      })),
    };
  });
}
