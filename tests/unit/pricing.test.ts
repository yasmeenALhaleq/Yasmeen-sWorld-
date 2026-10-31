import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyDiscount, checkCoupon, deliveryFee, giftPrice, resolvePrice, type DiscountRule,
} from "../../src/lib/pricing.ts";
import { formatMoney, parseMoney, roundMoney } from "../../src/lib/money.ts";

const now = new Date("2026-06-15T12:00:00Z");

function rule(over: Partial<DiscountRule>): DiscountRule {
  return {
    id: 1, name: "r", scope: "store", productId: null, categoryId: null,
    type: "percent", value: 10, startsAt: null, endsAt: null, isActive: true, ...over,
  };
}

const product = { id: 7, categoryId: 3 };

test("money is rounded to fils and formatted with 3 decimals", () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(formatMoney(12.5), "12.500 JOD");
  assert.equal(parseMoney("12,5"), 12.5);
  assert.equal(parseMoney("١٢.٥"), 12.5); // Arabic-Indic digits
  assert.equal(parseMoney("-3"), null);
  assert.equal(parseMoney("1.2345"), null);
});

test("percentage and fixed discounts never go below zero", () => {
  assert.equal(applyDiscount(20, "percent", 25), 15);
  assert.equal(applyDiscount(20, "fixed", 5), 15);
  assert.equal(applyDiscount(4, "fixed", 5), 0);
  assert.equal(applyDiscount(20, "percent", 150), 0);
});

test("with no rules the price is unchanged", () => {
  const r = resolvePrice(12, product, [], now);
  assert.deepEqual(r, { original: 12, final: 12, savings: 0, percentOff: 0, ruleId: null });
});

test("the best single rule wins and rules do not stack", () => {
  const rules = [
    rule({ id: 1, scope: "store", type: "percent", value: 10 }),
    rule({ id: 2, scope: "category", categoryId: 3, type: "percent", value: 30 }),
    rule({ id: 3, scope: "product", productId: 7, type: "fixed", value: 2 }),
  ];
  const r = resolvePrice(20, product, rules, now);
  assert.equal(r.final, 14);
  assert.equal(r.ruleId, 2);
  assert.equal(r.percentOff, 30);
});

test("rules for other products / categories do not apply", () => {
  const rules = [
    rule({ id: 1, scope: "product", productId: 99, value: 50 }),
    rule({ id: 2, scope: "category", categoryId: 4, value: 50 }),
  ];
  assert.equal(resolvePrice(10, product, rules, now).final, 10);
});

test("inactive, not-yet-started and expired rules are ignored", () => {
  const rules = [
    rule({ id: 1, isActive: false, value: 50 }),
    rule({ id: 2, startsAt: new Date("2026-07-01T00:00:00Z"), value: 50 }),
    rule({ id: 3, endsAt: new Date("2026-06-01T00:00:00Z"), value: 50 }),
    rule({ id: 4, startsAt: new Date("2026-06-01T00:00:00Z"), endsAt: new Date("2026-06-30T00:00:00Z"), value: 20 }),
  ];
  const r = resolvePrice(10, product, rules, now);
  assert.equal(r.ruleId, 4);
  assert.equal(r.final, 8);
});

test("a tiny discount still shows at least 1% off", () => {
  const r = resolvePrice(100, product, [rule({ type: "fixed", value: 0.1 })], now);
  assert.equal(r.percentOff, 1);
});

const coupon = {
  type: "percent" as const, value: 15, minOrder: 20, maxUses: 5, usedCount: 2,
  startsAt: null, endsAt: null, isActive: true,
};

test("coupon: valid percentage coupon", () => {
  assert.deepEqual(checkCoupon(coupon, 40, now), { ok: true, discount: 6 });
});

test("coupon: minimum order, usage limit, dates and inactive are enforced", () => {
  assert.deepEqual(checkCoupon(coupon, 10, now), { ok: false, reason: "min_order", minOrder: 20 });
  assert.deepEqual(checkCoupon({ ...coupon, usedCount: 5 }, 40, now), { ok: false, reason: "used_up" });
  assert.deepEqual(checkCoupon({ ...coupon, endsAt: new Date("2026-01-01") }, 40, now), { ok: false, reason: "expired" });
  assert.deepEqual(checkCoupon({ ...coupon, startsAt: new Date("2027-01-01") }, 40, now), { ok: false, reason: "not_started" });
  assert.deepEqual(checkCoupon({ ...coupon, isActive: false }, 40, now), { ok: false, reason: "inactive" });
  assert.deepEqual(checkCoupon({ ...coupon, maxUses: null, usedCount: 999 }, 40, now), { ok: true, discount: 6 });
});

test("coupon: a fixed coupon can never exceed the subtotal", () => {
  const fixed = { ...coupon, type: "fixed" as const, value: 50, minOrder: 0 };
  assert.deepEqual(checkCoupon(fixed, 12, now), { ok: true, discount: 12 });
});

test("delivery is free above the threshold; a threshold of 0 disables the offer", () => {
  assert.equal(deliveryFee(4, 39.999, 40), 4);
  assert.equal(deliveryFee(4, 40, 40), 0);
  assert.equal(deliveryFee(4, 500, 0), 4);
});

test("custom gift price = base size + items + wrapping + ribbon", () => {
  const price = giftPrice({
    sizePrice: 14,
    items: [{ unitPrice: 6.5, qty: 2 }, { unitPrice: 3.25, qty: 1 }],
    wrappingPrice: 1.5,
    ribbonPrice: 0.5,
  });
  assert.equal(price, 32.25);
});
