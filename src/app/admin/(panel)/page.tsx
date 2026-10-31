import Link from "next/link";
import { getDashboardData } from "@/server/services/dashboard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Icon } from "@/components/ui/Icon";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { imageUrl } from "@/lib/images";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n";

export const metadata = { title: "Overview" };

function Stat({ label, value, hint, href, tone }: { label: string; value: string; hint?: string; href?: string; tone?: "warn" }) {
  const body = (
    <div className={`card card-pad h-full ${tone === "warn" ? "border-amber-400 bg-amber-50" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</p>
      <p className="mt-1 font-serif text-4xl font-bold leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink/65">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full transition hover:-translate-y-0.5">{body}</Link> : body;
}

export default async function DashboardPage() {
  const d = await getDashboardData();
  const maxDay = Math.max(...d.daily.map((x) => x.total), 1);

  return (
    <>
      <AdminPageHeader title="Overview" description="How the shop is doing right now." />

      {d.demoItems > 0 && (
        <p className="alert alert-info mb-6">
          The shop currently contains <strong>sample content</strong> (products, banners, testimonials) so you can see how it looks.
          Remove it before launch by running <code className="rounded bg-primary/10 px-1.5 py-0.5">npm run db:demo:remove</code>.
        </p>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total sales" value={formatMoney(d.totalSales)} hint={`${formatMoney(d.monthSales)} this month`} />
        <Stat label="Today's orders" value={String(d.todayOrders)} hint={`${formatMoney(d.todaySales)} today`} href="/admin/orders" />
        <Stat label="Pending orders" value={String(d.pendingOrders)} hint="New, waiting to be handled" href="/admin/orders?status=new" tone={d.pendingOrders > 0 ? "warn" : undefined} />
        <Stat label="Low stock" value={String(d.lowStock.length)} hint="Products to restock" href="/admin/products?status=low" tone={d.lowStock.length > 0 ? "warn" : undefined} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2" aria-labelledby="sales-title">
          <h2 id="sales-title" className="!text-2xl">Sales, last 14 days</h2>
          <div className="mt-4 flex h-44 items-end gap-1.5" role="img" aria-label={`Daily sales for the last 14 days. Highest day: ${formatMoney(maxDay)}.`}>
            {d.daily.map((day) => (
              <div key={day.date} className="group flex h-full flex-1 flex-col justify-end" title={`${day.date}: ${formatMoney(day.total)} (${day.orders} orders)`}>
                <div
                  className="w-full rounded-t-md bg-primary/80 transition group-hover:bg-primary"
                  style={{ height: `${Math.max((day.total / maxDay) * 100, day.total > 0 ? 4 : 1)}%`, opacity: day.total > 0 ? 1 : 0.2 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-ink/55">
            <span>{d.daily[0].date.slice(5)}</span>
            <span>{d.daily[d.daily.length - 1].date.slice(5)}</span>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink/70">
            <span>{d.preparingOrders} preparing</span>
            <span>{d.outForDelivery} out for delivery</span>
          </p>
        </section>

        <section className="card card-pad" aria-labelledby="best-title">
          <h2 id="best-title" className="!text-2xl">Best sellers</h2>
          {d.bestSellers.length === 0 ? (
            <p className="mt-3 text-sm text-ink/65">Best sellers appear here once you have received orders.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {d.bestSellers.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-xl hover:bg-primary/5">
                    {p.imageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl(p.imageKey, 400)} alt="" className="h-11 w-11 rounded-lg object-cover" />
                    ) : (
                      <span className="h-11 w-11 rounded-lg bg-primary/10" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                    <span className="text-sm text-ink/65">{p.soldCount} sold</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card card-pad lg:col-span-2" aria-labelledby="recent-title">
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="!text-2xl">Latest orders</h2>
            <Link href="/admin/orders" className="text-sm font-semibold text-primary underline underline-offset-2">All orders</Link>
          </div>
          {d.recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-ink/65">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-primary/10">
              {d.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-primary/5">
                    <span className="font-bold">{o.orderNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{o.customerName}</span>
                    <span className="text-xs text-ink/60">{formatDateTime(new Date(o.createdAt))}</span>
                    <span className="badge badge-soft">{t(`status.${o.status}` as MessageKey)}</span>
                    <span className="w-24 text-end text-sm font-bold">{formatMoney(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-pad" aria-labelledby="low-title">
          <h2 id="low-title" className="!text-2xl">Low stock alerts</h2>
          {d.lowStock.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink/65"><Icon name="check-circle" className="h-4 w-4 text-emerald-700" /> Everything is well stocked.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.lowStock.map((p, i) => (
                <li key={`${p.productId}-${i}`}>
                  <Link href={`/admin/products/${p.productId}`} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm hover:bg-primary/5">
                    <span className="min-w-0 truncate">{p.name}{p.label ? ` · ${p.label}` : ""}</span>
                    <span className={`badge ${p.stock <= 0 ? "badge-bad" : "badge-warn"}`}>{p.stock <= 0 ? "Out" : `${p.stock} left`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
