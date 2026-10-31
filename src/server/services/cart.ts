import "server-only";
import { query, placeholders, type Tx } from "@/server/db/pool";
import { getDiscountRules } from "@/server/services/catalog";
import { getSettings } from "@/server/services/settings";
import { formatMoney, roundMoney } from "@/lib/money";
import { checkCoupon, deliveryFee, giftPrice, resolvePrice } from "@/lib/pricing";
import { t } from "@/i18n";
import type {
  CartLineInput, CartQuote, GiftBaseType, GiftSummary, ImageRef, PricedLine,
} from "@/lib/types";

// Prices a cart from the database. The browser only ever sends WHAT is in the
// cart (ids and quantities); every price, discount, fee and stock figure comes
// from here. The same function backs the live cart page and the locked,
// transactional order placement (pass `tx` + `forUpdate`).

export interface QuoteOptions {
  cityId?: number | null;
  couponCode?: string | null;
  /** Lock the product / variant / coupon rows (only valid inside a transaction). */
  tx?: Tx;
  forUpdate?: boolean;
}

/** One unit of stock to take when the order is placed. */
export interface StockUse {
  type: "product" | "variant";
  id: number;
  productId: number;
  qty: number;
}

export interface ResolvedLine {
  priced: PricedLine;
  productId: number | null;
  variantId: number | null;
  stockUses: StockUse[];
  /** Units of each product sold (drives best-seller ranking). */
  sold: { productId: number; qty: number }[];
  gift: GiftSummary | null;
  imageKey: string | null;
}

export interface QuoteResult {
  quote: CartQuote;
  lines: ResolvedLine[];
  city: { id: number; name: string; fee: number } | null;
  coupon: { id: number; code: string; discount: number } | null;
}

interface ProductRow {
  id: number; slug: string; name: string; price: number; category_id: number | null; track_stock: number;
  stock_quantity: number; in_builder: number;
}
interface VariantRow { id: number; product_id: number; label: string; price_delta: number; stock_quantity: number }

const lock = (o: QuoteOptions) => (o.forUpdate && o.tx ? " FOR UPDATE" : "");
const unique = <T,>(xs: T[]) => [...new Set(xs)];
const clampQty = (n: number) => Math.min(Math.max(Math.trunc(Number(n) || 1), 1), 99);

export async function quoteCart(inputLines: CartLineInput[], opts: QuoteOptions = {}): Promise<QuoteResult> {
  const conn = opts.tx;
  const lines = inputLines.slice(0, 40);
  const settings = await getSettings();
  const rules = await getDiscountRules();
  const now = new Date();

  // ---- 1. gather every id we need -------------------------------------------------
  const productIds = unique(lines.flatMap((l) => (l.kind === "product" ? [l.productId] : l.items.map((i) => i.productId))));
  const sizeIds = unique(lines.flatMap((l) => (l.kind === "gift" ? [l.sizeId] : [])));
  const optionIds = unique(lines.flatMap((l) => (l.kind === "gift" ? [l.wrappingId, l.ribbonId].filter((x): x is number => !!x) : [])));
  const occasionIds = unique(lines.flatMap((l) => (l.kind === "gift" && l.occasionId ? [l.occasionId] : [])));

  // ---- 2. load them (ordered by id so concurrent orders lock in the same order) ------
  const products = productIds.length
    ? await query<ProductRow>(
        `SELECT id, slug, name, price, category_id, track_stock, stock_quantity, in_builder
           FROM products WHERE is_active = 1 AND id IN (${placeholders(productIds.length)}) ORDER BY id${lock(opts)}`,
        productIds, conn)
    : [];
  const allVariants = productIds.length
    ? await query<VariantRow>(
        `SELECT id, product_id, label, price_delta, stock_quantity FROM product_variants
          WHERE is_active = 1 AND product_id IN (${placeholders(productIds.length)}) ORDER BY id${lock(opts)}`,
        productIds, conn)
    : [];
  const images = productIds.length
    ? await query<{ product_id: number; image_key: string; alt: string | null }>(
        `SELECT product_id, image_key, alt FROM product_images WHERE product_id IN (${placeholders(productIds.length)}) ORDER BY product_id, sort_order, id`,
        productIds, conn)
    : [];
  const sizes = sizeIds.length
    ? await query<{ id: number; name: string; price: number; max_items: number; base_name: string; base_type: GiftBaseType; base_image: string | null }>(
        `SELECT s.id, s.name, s.price, s.max_items, b.name AS base_name, b.type AS base_type, b.image_key AS base_image
           FROM gift_base_sizes s JOIN gift_bases b ON b.id = s.base_id
          WHERE s.is_active = 1 AND b.is_active = 1 AND s.id IN (${placeholders(sizeIds.length)})`,
        sizeIds, conn)
    : [];
  const options = optionIds.length
    ? await query<{ id: number; type: "wrapping" | "ribbon"; name: string; color_hex: string | null; price: number }>(
        `SELECT id, type, name, color_hex, price FROM gift_options WHERE is_active = 1 AND id IN (${placeholders(optionIds.length)})`,
        optionIds, conn)
    : [];
  const occasions = occasionIds.length
    ? await query<{ id: number; name: string }>(
        `SELECT id, name FROM occasions WHERE is_active = 1 AND in_builder = 1 AND id IN (${placeholders(occasionIds.length)})`,
        occasionIds, conn)
    : [];

  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(allVariants.map((v) => [v.id, v]));
  const variantsOf = (productId: number) => allVariants.filter((v) => v.product_id === productId);
  const imageOf = new Map<number, ImageRef>();
  for (const i of images) if (!imageOf.has(i.product_id)) imageOf.set(i.product_id, { key: i.image_key, alt: i.alt ?? "" });
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const optionById = new Map(options.map((o) => [o.id, o]));
  const occasionById = new Map(occasions.map((o) => [o.id, o]));

  /** Unit price + availability of one product (and variant). Null when it cannot be sold. */
  const unitFor = (productId: number, variantId: number | null) => {
    const p = productById.get(productId);
    if (!p) return null;
    const vs = variantsOf(productId);
    let delta = 0;
    let variant: VariantRow | null = null;
    if (vs.length) {
      variant = variantId ? vs.find((v) => v.id === variantId) ?? null : null;
      if (!variant) return { ok: false as const, p, error: "cart.issue.chooseOption" as const };
      delta = Number(variant.price_delta);
    }
    const r = resolvePrice(Number(p.price) + delta, { id: p.id, categoryId: p.category_id }, rules, now);
    const stock = p.track_stock === 0 ? null : Math.max(variant ? variant.stock_quantity : p.stock_quantity, 0);
    const stockUse = variant
      ? ({ type: "variant", id: variant.id, productId: p.id } as const)
      : ({ type: "product", id: p.id, productId: p.id } as const);
    return { ok: true as const, p, variant, price: r, stock, stockUse };
  };

  // ---- 3. price each line -----------------------------------------------------------
  const resolved: ResolvedLine[] = lines.map((line): ResolvedLine => {
    const qty = clampQty(line.qty);
    const base = (over: Partial<PricedLine>): PricedLine => ({
      id: line.id, kind: line.kind, name: "", slug: null, variantLabel: null, image: null,
      unitPrice: 0, originalUnitPrice: 0, qty, lineTotal: 0, maxQty: null, issues: [], ...over,
    });

    if (line.kind === "product") {
      const u = unitFor(line.productId, line.variantId);
      if (!u) {
        return { priced: base({ name: "—", issues: [t("cart.issue.unavailable")] }), productId: null, variantId: null, stockUses: [], sold: [], gift: null, imageKey: null };
      }
      if (!u.ok) {
        return { priced: base({ name: u.p.name, slug: u.p.slug, image: imageOf.get(u.p.id) ?? null, issues: [t(u.error)] }), productId: u.p.id, variantId: null, stockUses: [], sold: [], gift: null, imageKey: null };
      }
      const image = imageOf.get(u.p.id) ?? null;
      return {
        priced: base({
          name: u.p.name, slug: u.p.slug, variantLabel: u.variant?.label ?? null, image,
          unitPrice: u.price.final, originalUnitPrice: u.price.original, lineTotal: roundMoney(u.price.final * qty), maxQty: u.stock,
        }),
        productId: u.p.id, variantId: u.variant?.id ?? null,
        stockUses: u.stock === null ? [] : [{ ...u.stockUse, qty }],
        sold: [{ productId: u.p.id, qty }],
        gift: null, imageKey: image?.key ?? null,
      };
    }

    // ---- custom gift ----
    const size = sizeById.get(line.sizeId);
    const fail = (message: string, name = t("cart.gift.name", { base: size?.base_name ?? "—" })): ResolvedLine => ({
      priced: base({ name, issues: [message] }), productId: null, variantId: null, stockUses: [], sold: [], gift: null, imageKey: null,
    });
    if (!size) return fail(t("cart.issue.giftInvalid"));

    const wrapping = line.wrappingId ? optionById.get(line.wrappingId) : undefined;
    const ribbon = line.ribbonId ? optionById.get(line.ribbonId) : undefined;
    if ((line.wrappingId && wrapping?.type !== "wrapping") || (line.ribbonId && ribbon?.type !== "ribbon")) {
      return fail(t("cart.issue.giftInvalid"));
    }

    const giftItems: GiftSummary["items"] = [];
    const priceItems: { unitPrice: number; qty: number }[] = [];
    const originalItems: { unitPrice: number; qty: number }[] = [];
    const uses: StockUse[] = [];
    const sold: { productId: number; qty: number }[] = [];
    let itemCount = 0;

    for (const item of line.items) {
      const u = unitFor(item.productId, item.variantId);
      if (!u || !u.ok || u.p.in_builder !== 1) return fail(t("cart.issue.giftInvalid"));
      const q = clampQty(item.qty);
      itemCount += q;
      const image = imageOf.get(u.p.id) ?? null;
      giftItems.push({
        productId: u.p.id, variantId: u.variant?.id ?? null,
        name: u.variant ? `${u.p.name} (${u.variant.label})` : u.p.name, qty: q, unitPrice: u.price.final, image,
      });
      priceItems.push({ unitPrice: u.price.final, qty: q });
      originalItems.push({ unitPrice: u.price.original, qty: q });
      if (u.stock !== null) uses.push({ ...u.stockUse, qty: q * qty });
      sold.push({ productId: u.p.id, qty: q * qty });
    }
    const issues: string[] = [];
    if (itemCount === 0) issues.push(t("cart.issue.giftInvalid"));
    if (itemCount > size.max_items) issues.push(t("cart.issue.giftTooMany"));

    const wrapPrice = wrapping ? Number(wrapping.price) : 0;
    const ribbonPrice = ribbon ? Number(ribbon.price) : 0;
    const unit = giftPrice({ sizePrice: Number(size.price), items: priceItems, wrappingPrice: wrapPrice, ribbonPrice });
    const original = giftPrice({ sizePrice: Number(size.price), items: originalItems, wrappingPrice: wrapPrice, ribbonPrice });

    const gift: GiftSummary = {
      occasion: line.occasionId ? occasionById.get(line.occasionId)?.name ?? null : null,
      base: size.base_name,
      baseType: size.base_type,
      size: size.name,
      wrapping: wrapping?.name ?? null,
      ribbon: ribbon ? { name: ribbon.name, color: ribbon.color_hex } : null,
      cardMessage: line.cardMessage.replace(/\s+/g, " ").trim().slice(0, 300),
      items: giftItems,
    };
    const image = giftItems[0]?.image ?? (size.base_image ? { key: size.base_image, alt: size.base_name } : null);
    return {
      priced: base({
        name: t("cart.gift.name", { base: `${size.base_name} (${size.name})` }), image,
        unitPrice: unit, originalUnitPrice: original, lineTotal: roundMoney(unit * qty), issues, gift,
      }),
      productId: null, variantId: null, stockUses: uses, sold, gift, imageKey: image?.key ?? null,
    };
  });

  // ---- 4. stock check across the WHOLE cart (the same item can appear twice) ----------
  const demand = new Map<string, number>();
  const available = new Map<string, number>();
  for (const l of resolved) {
    for (const use of l.stockUses) {
      const key = `${use.type}:${use.id}`;
      demand.set(key, (demand.get(key) ?? 0) + use.qty);
      const row = use.type === "variant" ? variantById.get(use.id) : productById.get(use.id);
      available.set(key, Math.max(row?.stock_quantity ?? 0, 0));
    }
  }
  for (const l of resolved) {
    for (const use of l.stockUses) {
      const key = `${use.type}:${use.id}`;
      const have = available.get(key) ?? 0;
      if ((demand.get(key) ?? 0) > have) {
        l.priced.issues.push(have === 0 ? t("cart.issue.outOfStock") : t("cart.issue.onlyLeft", { count: have }));
        break;
      }
    }
  }

  // ---- 5. totals, coupon, delivery ------------------------------------------------------
  const priceable = resolved.filter((l) => l.priced.unitPrice > 0 || l.priced.issues.length === 0);
  const subtotal = roundMoney(priceable.reduce((s, l) => s + l.priced.lineTotal, 0));
  const savings = roundMoney(priceable.reduce((s, l) => s + (l.priced.originalUnitPrice - l.priced.unitPrice) * l.priced.qty, 0));

  let coupon: QuoteResult["coupon"] = null;
  let couponError: string | null = null;
  const code = (opts.couponCode ?? "").trim().toUpperCase().slice(0, 40);
  if (code) {
    const row = (await query<{
      id: number; code: string; type: "percent" | "fixed"; value: number; min_order: number; max_uses: number | null;
      used_count: number; starts_at: Date | null; ends_at: Date | null; is_active: number;
    }>(
      `SELECT id, code, type, value, min_order, max_uses, used_count, starts_at, ends_at, is_active FROM coupons WHERE code = ?${lock(opts)}`,
      [code], conn))[0];
    if (!row) couponError = t("coupon.invalid");
    else {
      const check = checkCoupon(
        { type: row.type, value: Number(row.value), minOrder: Number(row.min_order), maxUses: row.max_uses, usedCount: row.used_count,
          startsAt: row.starts_at, endsAt: row.ends_at, isActive: row.is_active === 1 },
        subtotal, now);
      if (check.ok) coupon = { id: row.id, code: row.code, discount: check.discount };
      else {
        couponError = {
          inactive: t("coupon.invalid"), not_started: t("coupon.notStarted"), expired: t("coupon.expired"), used_up: t("coupon.usedUp"),
          min_order: t("coupon.minOrder", { amount: formatMoney(check.minOrder ?? 0) }),
        }[check.reason];
      }
    }
  }

  const afterCoupon = roundMoney(Math.max(subtotal - (coupon?.discount ?? 0), 0));
  let city: QuoteResult["city"] = null;
  if (opts.cityId) {
    const c = (await query<{ id: number; name: string; fee: number }>(
      "SELECT id, name, fee FROM cities WHERE id = ? AND is_active = 1", [opts.cityId], conn))[0];
    if (c) city = { id: c.id, name: c.name, fee: Number(c.fee) };
  }
  const fee = city ? deliveryFee(city.fee, afterCoupon, settings.freeDeliveryThreshold) : null;
  const threshold = settings.freeDeliveryThreshold;
  const remaining = threshold > 0 && afterCoupon < threshold && subtotal > 0 ? roundMoney(threshold - afterCoupon) : null;

  const quote: CartQuote = {
    lines: resolved.map((l) => l.priced),
    subtotal,
    savings,
    coupon: coupon ? { code: coupon.code, discount: coupon.discount } : null,
    couponError,
    deliveryFee: fee,
    total: roundMoney(afterCoupon + (fee ?? 0)),
    freeDeliveryRemaining: remaining,
    canCheckout: resolved.length > 0 && resolved.every((l) => l.priced.issues.length === 0),
  };
  return { quote, lines: resolved, city, coupon };
}
