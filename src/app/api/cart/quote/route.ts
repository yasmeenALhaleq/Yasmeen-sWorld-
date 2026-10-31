import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/cart-schema";
import { quoteCart } from "@/server/services/cart";
import { allow } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";

// Prices a cart. The browser sends ids + quantities, the server answers with
// real prices, discounts, stock problems, coupon result and delivery fee.
export async function POST(request: Request) {
  if (!allow(`quote:${await getClientIp()}`, 90, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart." }, { status: 400 });

  const { quote } = await quoteCart(parsed.data.lines, { cityId: parsed.data.cityId, couponCode: parsed.data.couponCode });
  return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
}
