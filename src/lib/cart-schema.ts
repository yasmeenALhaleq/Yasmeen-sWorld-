import { z } from "zod";

// Shape of a cart as sent by the browser. Only ids and quantities: prices are
// always recalculated on the server (see src/server/services/cart.ts).
const id = z.number().int().positive();
const lineId = z.string().min(1).max(64);

export const cartLineSchema = z.discriminatedUnion("kind", [
  z.object({
    id: lineId,
    kind: z.literal("product"),
    productId: id,
    variantId: id.nullable().default(null),
    qty: z.number().int().min(1).max(99),
  }),
  z.object({
    id: lineId,
    kind: z.literal("gift"),
    occasionId: id.nullable().default(null),
    sizeId: id,
    items: z.array(z.object({ productId: id, variantId: id.nullable().default(null), qty: z.number().int().min(1).max(99) })).min(1).max(60),
    wrappingId: id.nullable().default(null),
    ribbonId: id.nullable().default(null),
    cardMessage: z.string().max(300).default(""),
    qty: z.number().int().min(1).max(20),
  }),
]);

export const cartSchema = z.array(cartLineSchema).max(40);

export const quoteRequestSchema = z.object({
  lines: cartSchema,
  cityId: id.nullable().default(null),
  couponCode: z.string().trim().max(40).nullable().default(null),
});
