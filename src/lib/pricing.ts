// Pure pricing rules: automatic discounts, coupons, delivery fees and the
// price of a custom gift. No database or framework imports so it can be
// unit-tested directly (see tests/unit/pricing.test.ts).
import { roundMoney } from "./money.ts";

export type DiscountType = "percent" | "fixed";
export type DiscountScope = "product" | "category" | "store";

export interface DiscountRule {
  id: number;
  name: string;
  scope: DiscountScope;
  productId: number | null;
  categoryId: number | null;
  type: DiscountType;
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface PriceResult {
  original: number;
  final: number;
  savings: number;
  /** Whole-number percentage for the "-20%" badge (0 when not on sale). */
  percentOff: number;
  ruleId: number | null;
}

/** A rule is live when it is switched on and "now" is inside its date window. */
export function isRuleLive(rule: DiscountRule, now: Date): boolean {
  if (!rule.isActive) return false;
  if (rule.startsAt && rule.startsAt.getTime() > now.getTime()) return false;
  if (rule.endsAt && rule.endsAt.getTime() < now.getTime()) return false;
  return true;
}

export function ruleAppliesTo(
  rule: DiscountRule,
  product: { id: number; categoryId: number | null },
): boolean {
  if (rule.scope === "store") return true;
  if (rule.scope === "category") return rule.categoryId !== null && rule.categoryId === product.categoryId;
  return rule.productId !== null && rule.productId === product.id;
}

/** Applies a single rule to a price. Never returns less than zero. */
export function applyDiscount(price: number, type: DiscountType, value: number): number {
  const next = type === "percent" ? price * (1 - Math.min(Math.max(value, 0), 100) / 100) : price - Math.max(value, 0);
  return roundMoney(Math.max(next, 0));
}

/**
 * Resolves the selling price of a product. Rules never stack: the rule that
 * gives the lowest price wins.
 */
export function resolvePrice(
  basePrice: number,
  product: { id: number; categoryId: number | null },
  rules: DiscountRule[],
  now: Date = new Date(),
): PriceResult {
  const original = roundMoney(basePrice);
  let final = original;
  let ruleId: number | null = null;

  for (const rule of rules) {
    if (!isRuleLive(rule, now) || !ruleAppliesTo(rule, product)) continue;
    const candidate = applyDiscount(original, rule.type, rule.value);
    if (candidate < final) {
      final = candidate;
      ruleId = rule.id;
    }
  }

  const savings = roundMoney(original - final);
  let percentOff = 0;
  if (savings > 0 && original > 0) percentOff = Math.max(1, Math.round((savings / original) * 100));
  return { original, final, savings, percentOff, ruleId };
}

// ---------------------------------------------------------------- coupons

export interface CouponRule {
  type: DiscountType;
  value: number;
  minOrder: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export type CouponFailure = "inactive" | "not_started" | "expired" | "used_up" | "min_order";

export type CouponCheck = { ok: true; discount: number } | { ok: false; reason: CouponFailure; minOrder?: number };

/** Validates a coupon against the cart subtotal and returns the discount amount. */
export function checkCoupon(coupon: CouponRule, subtotal: number, now: Date = new Date()): CouponCheck {
  if (!coupon.isActive) return { ok: false, reason: "inactive" };
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return { ok: false, reason: "not_started" };
  if (coupon.endsAt && coupon.endsAt.getTime() < now.getTime()) return { ok: false, reason: "expired" };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { ok: false, reason: "used_up" };
  if (subtotal < coupon.minOrder) return { ok: false, reason: "min_order", minOrder: coupon.minOrder };
  // A coupon can never make the items cost less than zero.
  const raw = coupon.type === "percent" ? subtotal * (Math.min(coupon.value, 100) / 100) : coupon.value;
  return { ok: true, discount: roundMoney(Math.min(Math.max(raw, 0), subtotal)) };
}

// --------------------------------------------------------------- delivery

/** Delivery fee for a city; free once the (post-coupon) subtotal reaches the threshold (0 = disabled). */
export function deliveryFee(cityFee: number, subtotalAfterDiscounts: number, freeThreshold: number): number {
  if (freeThreshold > 0 && subtotalAfterDiscounts >= freeThreshold) return 0;
  return roundMoney(cityFee);
}

// ------------------------------------------------------------ custom gifts

export interface GiftPriceInput {
  sizePrice: number;
  items: { unitPrice: number; qty: number }[];
  wrappingPrice: number;
  ribbonPrice: number;
}

export function giftPrice(input: GiftPriceInput): number {
  const itemsTotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  return roundMoney(input.sizePrice + itemsTotal + input.wrappingPrice + input.ribbonPrice);
}
