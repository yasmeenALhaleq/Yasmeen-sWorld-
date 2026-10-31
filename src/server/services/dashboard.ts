import "server-only";
import { query, queryOne } from "@/server/db/pool";
import { env } from "@/server/env";
import { addDays, dayBoundsUtc, offsetMinutes, todayIn } from "@/lib/time";

export interface DashboardData {
  totalSales: number;
  monthSales: number;
  todayOrders: number;
  todaySales: number;
  pendingOrders: number;
  preparingOrders: number;
  outForDelivery: number;
  lowStock: { kind: "product" | "variant"; productId: number; name: string; label: string | null; stock: number; threshold: number }[];
  bestSellers: { id: number; name: string; soldCount: number; imageKey: string | null }[];
  recentOrders: { id: number; orderNumber: string; customerName: string; total: number; status: string; createdAt: string }[];
  daily: { date: string; total: number; orders: number }[];
  demoItems: number;
}

export async function getDashboardData(): Promise<DashboardData> {
  const tz = env.timeZone;
  const today = todayIn(tz);
  const { start: dayStart, end: dayEnd } = dayBoundsUtc(today, tz);
  const monthStartYmd = `${today.slice(0, 8)}01`;
  const { start: monthStart } = dayBoundsUtc(monthStartYmd, tz);
  const fromYmd = addDays(today, -13);
  const { start: chartStart } = dayBoundsUtc(fromYmd, tz);
  const offset = offsetMinutes(new Date(), tz);

  const [totals, month, todayRow, statusRows, low, best, recent, dailyRows, demo] = await Promise.all([
    queryOne<{ s: number | null }>("SELECT SUM(total) AS s FROM orders WHERE status <> 'cancelled'"),
    queryOne<{ s: number | null }>("SELECT SUM(total) AS s FROM orders WHERE status <> 'cancelled' AND created_at >= ?", [monthStart]),
    queryOne<{ n: number; s: number | null }>(
      "SELECT COUNT(*) AS n, SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END) AS s FROM orders WHERE created_at >= ? AND created_at < ?",
      [dayStart, dayEnd]),
    query<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM orders WHERE status IN ('new','preparing','out_for_delivery') GROUP BY status"),
    query<{ kind: "product" | "variant"; product_id: number; name: string; label: string | null; stock: number; threshold: number }>(
      `(SELECT 'product' AS kind, p.id AS product_id, p.name, NULL AS label, p.stock_quantity AS stock, p.low_stock_threshold AS threshold
          FROM products p
         WHERE p.is_active = 1 AND p.track_stock = 1 AND p.stock_quantity <= p.low_stock_threshold
           AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1))
       UNION ALL
       (SELECT 'variant', p.id, p.name, v.label, v.stock_quantity, p.low_stock_threshold
          FROM product_variants v JOIN products p ON p.id = v.product_id
         WHERE p.is_active = 1 AND p.track_stock = 1 AND v.is_active = 1 AND v.stock_quantity <= p.low_stock_threshold)
       ORDER BY stock, name LIMIT 12`),
    query<{ id: number; name: string; sold_count: number; image_key: string | null }>(
      `SELECT p.id, p.name, p.sold_count,
              (SELECT image_key FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image_key
         FROM products p WHERE p.sold_count > 0 ORDER BY p.sold_count DESC LIMIT 5`),
    query<{ id: number; order_number: string; customer_name: string; total: number; status: string; created_at: Date }>(
      "SELECT id, order_number, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 6"),
    query<{ d: string; total: number; n: number }>(
      `SELECT DATE_FORMAT(DATE_ADD(created_at, INTERVAL ? MINUTE), '%Y-%m-%d') AS d, SUM(total) AS total, COUNT(*) AS n
         FROM orders WHERE status <> 'cancelled' AND created_at >= ? GROUP BY d`,
      [offset, chartStart]),
    queryOne<{ n: number }>(
      "SELECT (SELECT COUNT(*) FROM products WHERE is_demo = 1) + (SELECT COUNT(*) FROM testimonials WHERE is_demo = 1) + (SELECT COUNT(*) FROM banners WHERE is_demo = 1) AS n"),
  ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)]));
  const dailyMap = new Map(dailyRows.map((r) => [r.d, r]));
  const daily = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(fromYmd, i);
    const row = dailyMap.get(date);
    return { date, total: Number(row?.total ?? 0), orders: Number(row?.n ?? 0) };
  });

  return {
    totalSales: Number(totals?.s ?? 0),
    monthSales: Number(month?.s ?? 0),
    todayOrders: Number(todayRow?.n ?? 0),
    todaySales: Number(todayRow?.s ?? 0),
    pendingOrders: byStatus.new ?? 0,
    preparingOrders: byStatus.preparing ?? 0,
    outForDelivery: byStatus.out_for_delivery ?? 0,
    lowStock: low.map((r) => ({ kind: r.kind, productId: r.product_id, name: r.name, label: r.label, stock: r.stock, threshold: r.threshold })),
    bestSellers: best.map((r) => ({ id: r.id, name: r.name, soldCount: r.sold_count, imageKey: r.image_key })),
    recentOrders: recent.map((r) => ({
      id: r.id, orderNumber: r.order_number, customerName: r.customer_name, total: Number(r.total), status: r.status, createdAt: r.created_at.toISOString(),
    })),
    daily,
    demoItems: Number(demo?.n ?? 0),
  };
}
