"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cartSchema } from "@/lib/cart-schema";
import { normalizeDigits } from "@/lib/money";
import { placeOrder } from "@/server/services/orders";
import { allow } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { formValues, fieldErrors } from "@/server/admin/validation";
import { t } from "@/i18n";
import type { ActionState } from "@/lib/entity-types";
import type { CartLineInput } from "@/lib/types";

/** "+962 7 9123-4567" -> "+96279123456". Returns null if it does not look like a phone number. */
function normalizePhone(raw: string): string | null {
  const cleaned = normalizeDigits(raw).replace(/[\s\-().]/g, "");
  return /^\+?\d{8,15}$/.test(cleaned) ? cleaned : null;
}

const schema = z.object({
  customerName: z.string().trim().min(2, t("checkout.v.name")).max(120, t("checkout.v.tooLong")),
  phone: z.string().trim().transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: t("checkout.v.phone") });
    return p ?? v;
  }),
  email: z.union([z.literal(""), z.string().trim().email(t("checkout.v.email")).max(190)]),
  cityId: z.coerce.number({ error: t("checkout.error.city") }).int().positive(t("checkout.error.city")),
  address: z.string().trim().min(6, t("checkout.v.address")).max(500, t("checkout.v.tooLong")),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("checkout.error.date")),
  giftMessage: z.string().trim().max(300, t("checkout.v.giftMessage")),
  notes: z.string().trim().max(500, t("checkout.v.tooLong")),
  paymentMethod: z.string().min(1, t("checkout.error.payment")).max(24),
  couponCode: z.string().trim().max(40),
  website: z.string().max(0), // honeypot: real people never fill this in
});

export async function placeOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const values = formValues(form);
  const raw = Object.fromEntries(
    ["customerName", "phone", "email", "cityId", "address", "deliveryDate", "giftMessage", "notes", "paymentMethod", "couponCode", "website"]
      .map((k) => [k, String(form.get(k) ?? "")]),
  );

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { error: t("common.somethingWrong"), values };
    return { error: t("checkout.v.fix"), fieldErrors: fieldErrors(parsed.error), values };
  }

  let lines: CartLineInput[];
  try {
    const cart = cartSchema.safeParse(JSON.parse(String(form.get("cart") ?? "[]")));
    if (!cart.success) return { error: t("checkout.error.emptyCart"), values };
    lines = cart.data as CartLineInput[];
  } catch {
    return { error: t("checkout.error.emptyCart"), values };
  }
  if (lines.length === 0) return { error: t("checkout.error.emptyCart"), values };

  const ip = await getClientIp();
  if (!allow(`order:${ip}`, 8, 10 * 60_000)) return { error: t("checkout.error.tooMany"), values };

  const d = parsed.data;
  const result = await placeOrder({
    customerName: d.customerName,
    phone: d.phone,
    email: d.email || null,
    address: d.address,
    cityId: d.cityId,
    deliveryDate: d.deliveryDate,
    giftMessage: d.giftMessage || null,
    notes: d.notes || null,
    paymentMethod: d.paymentMethod,
    couponCode: d.couponCode || null,
    lines,
    ip,
  });

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.field ? { [result.field]: result.error } : undefined, values };
  }
  // Online payment providers (later) can send the customer to a payment page first.
  if (result.redirectUrl) redirect(result.redirectUrl);
  redirect(`/order/${result.token}?new=1`);
}
