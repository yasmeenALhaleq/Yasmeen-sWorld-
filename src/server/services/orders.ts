import "server-only";
import crypto from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { clearCache } from "@/server/cache";
import { execute, query, queryOne, withTransaction } from "@/server/db/pool";
import { env, smtpConfigured } from "@/server/env";
import { quoteCart } from "@/server/services/cart";
import { getSettings } from "@/server/services/settings";
import { sendMail } from "@/server/services/email";
import { renderOrderConfirmation } from "@/server/email-templates";
import { getPaymentProvider } from "@/server/payments";
import { addDays, todayIn } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { escapeHtml } from "@/lib/html";
import { t } from "@/i18n";
import {
  ORDER_STATUSES,
  type CartLineInput, type GiftSummary, type OrderData, type OrderItemData, type OrderStatus, type PaymentStatus,
} from "@/lib/types";

// --------------------------------------------------------------- placing

export interface PlaceOrderInput {
  customerName: string;
  phone: string;
  email: string | null;
  address: string;
  cityId: number;
  deliveryDate: string; // YYYY-MM-DD
  giftMessage: string | null;
  notes: string | null;
  paymentMethod: string;
  couponCode: string | null;
  lines: CartLineInput[];
  ip: string;
}

export type PlaceOrderResult =
  | { ok: true; token: string; orderNumber: string; redirectUrl?: string }
  | { ok: false; error: string; field?: string };

function newOrderNumber(): string {
  const d = todayIn(env.timeZone).replace(/-/g, "").slice(2); // yymmdd
  return `BW-${d}-${crypto.randomInt(1000, 10000)}`;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const settings = await getSettings();

  const provider = getPaymentProvider(input.paymentMethod, settings);
  if (!provider) return { ok: false, error: t("checkout.error.payment"), field: "paymentMethod" };

  // Delivery date window (store time zone).
  const today = todayIn(env.timeZone);
  const earliest = addDays(today, settings.deliveryLeadDays);
  const latest = addDays(today, settings.deliveryMaxDays);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate)) return { ok: false, error: t("checkout.error.date"), field: "deliveryDate" };
  if (input.deliveryDate < earliest) {
    return { ok: false, error: t("checkout.error.dateTooSoon", { date: earliest }), field: "deliveryDate" };
  }
  if (input.deliveryDate > latest) {
    return { ok: false, error: t("checkout.error.dateTooFar", { days: settings.deliveryMaxDays }), field: "deliveryDate" };
  }

  type Failure = { ok: false; error: string; field?: string };
  const outcome = await withTransaction(async (tx): Promise<Failure | { ok: true; orderId: number; token: string; orderNumber: string }> => {
    // Price + lock stock rows inside the transaction: this is the authoritative check.
    const q = await quoteCart(input.lines, { cityId: input.cityId, couponCode: input.couponCode, tx, forUpdate: true });
    if (q.quote.lines.length === 0) return { ok: false, error: t("checkout.error.emptyCart") };
    if (!q.quote.canCheckout) return { ok: false, error: t("checkout.error.stockChanged") };
    if (!q.city) return { ok: false, error: t("checkout.error.city"), field: "cityId" };
    if (input.couponCode?.trim() && !q.coupon) return { ok: false, error: q.quote.couponError ?? t("coupon.invalid"), field: "couponCode" };

    const token = crypto.randomBytes(16).toString("hex");
    let orderId = 0;
    let orderNumber = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      orderNumber = newOrderNumber();
      try {
        const res = await execute(
          `INSERT INTO orders (order_number, public_token, customer_name, phone, email, address, city_id, city_name,
                               delivery_date, gift_message, notes, payment_method, payment_status, status,
                               subtotal, savings, coupon_id, coupon_code, coupon_discount, delivery_fee, total, ip)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'new', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderNumber, token, input.customerName, input.phone, input.email, input.address, q.city.id, q.city.name,
            input.deliveryDate, input.giftMessage, input.notes, provider.id,
            q.quote.subtotal, q.quote.savings, q.coupon?.id ?? null, q.coupon?.code ?? null, q.coupon?.discount ?? 0,
            q.quote.deliveryFee ?? 0, q.quote.total, input.ip,
          ],
          tx,
        );
        orderId = res.insertId;
        break;
      } catch (err) {
        if ((err as { code?: string }).code !== "ER_DUP_ENTRY" || attempt === 5) throw err;
      }
    }

    for (const line of q.lines) {
      const p = line.priced;
      await execute(
        `INSERT INTO order_items (order_id, kind, product_id, variant_id, name, variant_label, image_key, unit_price, quantity, line_total, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, line.gift ? "custom_gift" : "product", line.productId, line.variantId, p.name.slice(0, 255),
          p.variantLabel, line.imageKey, p.unitPrice, p.qty, p.lineTotal, line.gift ? JSON.stringify(line.gift) : null,
        ],
        tx,
      );
    }

    // Take stock (each statement is guarded, so overselling is impossible).
    const totals = new Map<string, { type: "product" | "variant"; id: number; qty: number }>();
    for (const line of q.lines) {
      for (const use of line.stockUses) {
        const key = `${use.type}:${use.id}`;
        const prev = totals.get(key);
        totals.set(key, { type: use.type, id: use.id, qty: (prev?.qty ?? 0) + use.qty });
      }
    }
    for (const use of [...totals.values()].sort((a, b) => a.id - b.id)) {
      const table = use.type === "variant" ? "product_variants" : "products";
      const res = await execute(
        `UPDATE ${table} SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?`,
        [use.qty, use.id, use.qty],
        tx,
      );
      if (res.affectedRows !== 1) throw new StockError();
    }
    const soldBy = new Map<number, number>();
    for (const line of q.lines) for (const s of line.sold) soldBy.set(s.productId, (soldBy.get(s.productId) ?? 0) + s.qty);
    for (const [productId, qty] of [...soldBy].sort((a, b) => a[0] - b[0])) {
      await execute("UPDATE products SET sold_count = sold_count + ? WHERE id = ?", [qty, productId], tx);
    }

    if (q.coupon) {
      const res = await execute(
        "UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)",
        [q.coupon.id],
        tx,
      );
      if (res.affectedRows !== 1) return { ok: false, error: t("coupon.usedUp"), field: "couponCode" };
    }

    await execute("INSERT INTO order_events (order_id, status, note) VALUES (?, 'new', 'Order placed')", [orderId], tx);
    return { ok: true, orderId, token, orderNumber };
  }).catch((err) => {
    if (err instanceof StockError) return { ok: false as const, error: t("checkout.error.stockChanged") };
    throw err;
  });

  if (!outcome.ok) return outcome;

  clearCache("catalog");
  const order = await getOrderById(outcome.orderId);
  if (order) await notifyNewOrder(order);

  let redirectUrl: string | undefined;
  if (provider.initiate && order) {
    const init = await provider.initiate({
      id: order.id, orderNumber: order.orderNumber, total: order.total, currency: "JOD",
      customerName: order.customerName, email: order.email,
    });
    redirectUrl = init.redirectUrl;
  }
  return { ok: true, token: outcome.token, orderNumber: outcome.orderNumber, redirectUrl };
}

class StockError extends Error {}

/** Customer confirmation + (when email is configured) a heads-up to the shop owner. */
async function notifyNewOrder(order: OrderData): Promise<void> {
  const settings = await getSettings();
  try {
    if (order.email) {
      await sendMail({ to: order.email, ...renderOrderConfirmation(order, settings), kind: "order_confirmation", orderId: order.id });
    }
    if (smtpConfigured() && settings.contactEmail) {
      const subject = `New order ${order.orderNumber} - ${formatMoney(order.total)}`;
      const html = `<p>New order <b>${escapeHtml(order.orderNumber)}</b> from ${escapeHtml(order.customerName)} (${escapeHtml(order.phone)}).</p>
<p>Delivery: ${escapeHtml(order.deliveryDate)}, ${escapeHtml(order.cityName)}. Total ${escapeHtml(formatMoney(order.total))}.</p>
<p><a href="${escapeHtml(env.siteUrl)}/admin/orders/${order.id}">Open in the dashboard</a></p>`;
      await sendMail({ to: settings.contactEmail, subject, html, text: subject, kind: "admin_new_order", orderId: order.id });
    }
  } catch (err) {
    // Email problems must never undo or fail an order that is already saved.
    console.error("[orders] notification failed:", err);
  }
}

// ---------------------------------------------------------------- reading

interface OrderRow {
  id: number; order_number: string; public_token: string; customer_name: string; phone: string; email: string | null;
  address: string; city_name: string; delivery_date: Date | string; gift_message: string | null; notes: string | null;
  payment_method: string; payment_status: PaymentStatus; status: OrderStatus; subtotal: number; savings: number;
  coupon_code: string | null; coupon_discount: number; delivery_fee: number; total: number; created_at: Date;
}

/** MySQL DATE columns arrive as a local-midnight Date; format without shifting the day. */
function toYmd(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

async function hydrate(rows: OrderRow[]): Promise<OrderData[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => "?").join(", ");
  const [items, events] = await Promise.all([
    query<{
      id: number; order_id: number; kind: "product" | "custom_gift"; product_id: number | null; name: string;
      variant_label: string | null; image_key: string | null; unit_price: number; quantity: number; line_total: number; meta: string | null;
    }>(`SELECT id, order_id, kind, product_id, name, variant_label, image_key, unit_price, quantity, line_total, meta FROM order_items WHERE order_id IN (${marks}) ORDER BY id`, ids),
    query<{ order_id: number; status: string; note: string | null; created_at: Date }>(
      `SELECT order_id, status, note, created_at FROM order_events WHERE order_id IN (${marks}) ORDER BY id`, ids),
  ]);

  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    publicToken: r.public_token,
    customerName: r.customer_name,
    phone: r.phone,
    email: r.email,
    address: r.address,
    cityName: r.city_name,
    deliveryDate: toYmd(r.delivery_date),
    giftMessage: r.gift_message,
    notes: r.notes,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    status: r.status,
    subtotal: Number(r.subtotal),
    savings: Number(r.savings),
    couponCode: r.coupon_code,
    couponDiscount: Number(r.coupon_discount),
    deliveryFee: Number(r.delivery_fee),
    total: Number(r.total),
    createdAt: r.created_at.toISOString(),
    items: items.filter((i) => i.order_id === r.id).map((i): OrderItemData => {
      let gift: GiftSummary | null = null;
      if (i.meta) {
        try { gift = JSON.parse(i.meta) as GiftSummary; } catch { gift = null; }
      }
      return {
        id: i.id, kind: i.kind, productId: i.product_id, name: i.name, variantLabel: i.variant_label, imageKey: i.image_key,
        unitPrice: Number(i.unit_price), quantity: i.quantity, lineTotal: Number(i.line_total), gift,
      };
    }),
    events: events.filter((e) => e.order_id === r.id).map((e) => ({ status: e.status, note: e.note, createdAt: e.created_at.toISOString() })),
  }));
}

const ORDER_COLUMNS = `id, order_number, public_token, customer_name, phone, email, address, city_name, delivery_date, gift_message,
  notes, payment_method, payment_status, status, subtotal, savings, coupon_code, coupon_discount, delivery_fee, total, created_at`;

export async function getOrderById(id: number): Promise<OrderData | null> {
  const row = await queryOne<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`, [id]);
  return row ? (await hydrate([row]))[0] : null;
}

/** Public lookup: the 32-character random token is the only key. */
export async function getOrderByToken(token: string): Promise<OrderData | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const row = await queryOne<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM orders WHERE public_token = ?`, [token]);
  return row ? (await hydrate([row]))[0] : null;
}

/** Real status of the customer's confirmation email, for the confirmation page. */
export async function getConfirmationEmailStatus(orderId: number): Promise<"sent" | "failed" | "not_configured" | null> {
  const row = await queryOne<{ status: "sent" | "failed" | "not_configured" }>(
    "SELECT status FROM email_outbox WHERE order_id = ? AND kind = 'order_confirmation' ORDER BY id DESC LIMIT 1",
    [orderId],
  );
  return row?.status ?? null;
}

export interface OrderListParams {
  status?: OrderStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface OrderListRow {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  cityName: string;
  deliveryDate: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  createdAt: string;
}

export async function listOrders(params: OrderListParams) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.status && ORDER_STATUSES.includes(params.status)) { where.push("o.status = ?"); args.push(params.status); }
  if (params.q?.trim()) {
    const like = `%${params.q.trim().replace(/[%_\\]/g, "\\$&")}%`;
    where.push("(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.phone LIKE ?)");
    args.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM orders o ${clause}`, args))?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(params.page ?? 1, 1), pages);
  const offset = (page - 1) * pageSize; // integers only: safe to inline

  const rows = await query<{
    id: number; order_number: string; customer_name: string; phone: string; city_name: string; delivery_date: Date | string;
    status: OrderStatus; payment_status: PaymentStatus; total: number; created_at: Date; item_count: number;
  }>(
    `SELECT o.id, o.order_number, o.customer_name, o.phone, o.city_name, o.delivery_date, o.status, o.payment_status, o.total, o.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o ${clause} ORDER BY o.created_at DESC, o.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    args,
  );
  const items: OrderListRow[] = rows.map((r) => ({
    id: r.id, orderNumber: r.order_number, customerName: r.customer_name, phone: r.phone, cityName: r.city_name,
    deliveryDate: toYmd(r.delivery_date), status: r.status, paymentStatus: r.payment_status, total: Number(r.total),
    itemCount: Number(r.item_count), createdAt: r.created_at.toISOString(),
  }));
  return { items, total, page, pages };
}

/** Counts per status for the filter tabs. */
export async function orderStatusCounts(): Promise<Record<OrderStatus | "all", number>> {
  const rows = await query<{ status: OrderStatus; n: number }>("SELECT status, COUNT(*) AS n FROM orders GROUP BY status");
  const out = { all: 0, new: 0, preparing: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 } as Record<OrderStatus | "all", number>;
  for (const r of rows) { out[r.status] = Number(r.n); out.all += Number(r.n); }
  return out;
}

// --------------------------------------------------------------- updating

export type UpdateResult = { ok: true } | { ok: false; error: string };

/** Gives stock, sales count and coupon use back when an order is cancelled. */
async function restoreOrder(tx: PoolConnection, orderId: number): Promise<void> {
  const items = await query<{
    kind: string; product_id: number | null; variant_id: number | null; quantity: number; meta: string | null;
  }>("SELECT kind, product_id, variant_id, quantity, meta FROM order_items WHERE order_id = ?", [orderId], tx);

  const give: { productId: number; variantId: number | null; qty: number }[] = [];
  for (const it of items) {
    if (it.kind === "product" && it.product_id) give.push({ productId: it.product_id, variantId: it.variant_id, qty: it.quantity });
    if (it.kind === "custom_gift" && it.meta) {
      try {
        const gift = JSON.parse(it.meta) as GiftSummary;
        for (const g of gift.items) give.push({ productId: g.productId, variantId: g.variantId ?? null, qty: g.qty * it.quantity });
      } catch { /* unreadable meta: nothing to restore */ }
    }
  }
  for (const g of give.sort((a, b) => a.productId - b.productId)) {
    // Only products that track stock get stock back.
    if (g.variantId) {
      await execute(
        `UPDATE product_variants v JOIN products p ON p.id = v.product_id
            SET v.stock_quantity = v.stock_quantity + ? WHERE v.id = ? AND p.track_stock = 1`,
        [g.qty, g.variantId], tx);
    } else {
      await execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND track_stock = 1", [g.qty, g.productId], tx);
    }
    await execute("UPDATE products SET sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?", [g.qty, g.productId], tx);
  }
  await execute(
    "UPDATE coupons c JOIN orders o ON o.coupon_id = c.id SET c.used_count = GREATEST(c.used_count - 1, 0) WHERE o.id = ?",
    [orderId], tx);
}

export async function updateOrderStatus(orderId: number, status: OrderStatus, adminId: number, note?: string): Promise<UpdateResult> {
  if (!ORDER_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };

  const result = await withTransaction(async (tx): Promise<UpdateResult> => {
    const order = await queryOne<{ status: OrderStatus }>("SELECT status FROM orders WHERE id = ? FOR UPDATE", [orderId], tx);
    if (!order) return { ok: false, error: "Order not found." };
    if (order.status === status) return { ok: true };
    if (order.status === "cancelled") return { ok: false, error: "A cancelled order cannot be reopened. Create a new order instead." };

    if (status === "cancelled") await restoreOrder(tx, orderId);
    await execute("UPDATE orders SET status = ? WHERE id = ?", [status, orderId], tx);
    await execute("INSERT INTO order_events (order_id, status, note, admin_id) VALUES (?, ?, ?, ?)", [orderId, status, note?.slice(0, 300) || null, adminId], tx);
    return { ok: true };
  });
  if (result.ok) clearCache("catalog");
  return result;
}

export async function updatePaymentStatus(orderId: number, status: PaymentStatus, adminId: number): Promise<UpdateResult> {
  if (!["unpaid", "paid", "refunded"].includes(status)) return { ok: false, error: "Unknown payment status." };
  const res = await execute("UPDATE orders SET payment_status = ? WHERE id = ?", [status, orderId]);
  if (res.affectedRows === 0) return { ok: false, error: "Order not found." };
  await execute("INSERT INTO order_events (order_id, status, note, admin_id) VALUES (?, 'payment', ?, ?)", [orderId, `Payment marked ${status}`, adminId]);
  return { ok: true };
}
