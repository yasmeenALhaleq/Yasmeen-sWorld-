import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { listOrders, orderStatusCounts } from "@/server/services/orders";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatDay } from "@/lib/time";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";
import { t, type MessageKey } from "@/i18n";

export const metadata = { title: "Orders" };

type SP = { [key: string]: string | string[] | undefined };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STATUS_BADGE: Record<OrderStatus, string> = {
  new: "badge-warn", preparing: "badge-soft", out_for_delivery: "badge-soft", delivered: "badge-ok", cancelled: "badge-bad",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const statusParam = first(sp.status);
  const status = ORDER_STATUSES.find((s) => s === statusParam);
  const q = first(sp.q)?.slice(0, 80);
  const [list, counts] = await Promise.all([listOrders({ status, q, page: Number(first(sp.page)) || 1 }), orderStatusCounts()]);

  const tabHref = (s?: OrderStatus) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("status", s);
    return `/admin/orders${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader title="Orders" description="Everything customers have ordered. Open an order to update its status or print the slip." />

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Order number, name or phone" />
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn btn-soft">Search</button>
      </form>

      <nav aria-label="Order status" className="mb-4 flex flex-wrap gap-2">
        <Link href={tabHref()} className="chip" aria-current={!status ? "true" : undefined}>All <span className="opacity-70">{counts.all}</span></Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={tabHref(s)} className="chip" aria-current={status === s ? "true" : undefined}>
            {t(`status.${s}` as MessageKey)} <span className="opacity-70">{counts[s]}</span>
          </Link>
        ))}
      </nav>

      {list.items.length === 0 ? (
        <p className="card card-pad text-center">No orders found.</p>
      ) : (
        <>
        {/* Phones: one card per order. */}
        <ul className="space-y-3 md:hidden" aria-label="Orders">
          {list.items.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="card card-pad block transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-primary">{o.orderNumber}</p>
                    <p className="truncate font-semibold">{o.customerName}</p>
                  </div>
                  <span className={`badge ${STATUS_BADGE[o.status]}`}>{t(`status.${o.status}` as MessageKey)}</span>
                </div>
                <p className="mt-2 text-sm text-ink/70">{formatDay(o.deliveryDate)} · {o.cityName}</p>
                <p className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-ink/60">{o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {t(`payment.${o.paymentStatus}` as MessageKey)}</span>
                  <strong className="text-base">{formatMoney(o.total)}</strong>
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="table-wrap hidden md:block">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Delivery</th>
                <th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-bold text-primary hover:underline">{o.orderNumber}</Link>
                    <div className="text-xs text-ink/60">{formatDateTime(new Date(o.createdAt))}</div>
                  </td>
                  <td>
                    <div className="font-semibold">{o.customerName}</div>
                    <a href={`tel:${o.phone}`} className="text-xs text-ink/65 hover:underline" dir="ltr">{o.phone}</a>
                  </td>
                  <td className="whitespace-nowrap">
                    <div>{formatDay(o.deliveryDate)}</div>
                    <div className="text-xs text-ink/60">{o.cityName}</div>
                  </td>
                  <td>{o.itemCount}</td>
                  <td className="whitespace-nowrap font-bold">
                    {formatMoney(o.total)}
                    <div className="text-xs font-normal text-ink/60">{t(`payment.${o.paymentStatus}` as MessageKey)}</div>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[o.status]}`}>{t(`status.${o.status}` as MessageKey)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <Pagination basePath="/admin/orders" params={{ q, status }} page={list.page} pages={list.pages} />
    </>
  );
}
