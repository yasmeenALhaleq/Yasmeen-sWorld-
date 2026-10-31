import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { OrderPaymentAndStatus } from "@/components/admin/OrderPanels";
import { OrderItems } from "@/components/OrderItems";
import { OrderTotals } from "@/components/OrderTotals";
import { Icon } from "@/components/ui/Icon";
import { getOrderById } from "@/server/services/orders";
import { formatDateTime, formatDay } from "@/lib/time";
import { t, type MessageKey } from "@/i18n";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) notFound();
  const order = await getOrderById(orderId);
  if (!order) notFound();

  const hasGiftInfo = Boolean(order.giftMessage) || order.items.some((i) => i.gift?.cardMessage);

  return (
    <>
      <AdminPageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(new Date(order.createdAt))}`}
        actions={
          <>
            <Link href="/admin/orders" className="btn btn-ghost btn-sm">All orders</Link>
            <Link href={`/admin/orders/${order.id}/print`} className="btn btn-primary btn-sm"><Icon name="printer" className="h-4 w-4" /> Print order slip</Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {hasGiftInfo && (
            <section className="card card-pad border-secondary bg-secondary/10" aria-labelledby="gift-title">
              <h2 id="gift-title" className="!text-2xl">Gift card message</h2>
              {order.giftMessage && <p className="mt-2 whitespace-pre-line text-lg italic">“{order.giftMessage}”</p>}
            </section>
          )}

          <section className="card card-pad" aria-labelledby="items-title">
            <h2 id="items-title" className="mb-2 !text-2xl">Items</h2>
            <OrderItems items={order.items} />
            <div className="mt-4 max-w-xs ms-auto"><OrderTotals order={order} /></div>
          </section>

          <section className="card card-pad" aria-labelledby="history-title">
            <h2 id="history-title" className="mb-3 !text-2xl">History</h2>
            <ol className="space-y-3 border-s-2 border-primary/20 ps-4">
              {[...order.events].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-bold">{e.status === "payment" ? "Payment" : t(`status.${e.status}` as MessageKey)}</p>
                  {e.note && <p className="text-sm text-ink/75">{e.note}</p>}
                  <p className="text-xs text-ink/55">{formatDateTime(new Date(e.createdAt))}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <OrderPaymentAndStatus orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} />

          <section className="card card-pad space-y-3" aria-labelledby="cust-title">
            <h2 id="cust-title" className="!text-2xl">Customer</h2>
            <p className="font-bold">{order.customerName}</p>
            <p className="flex items-center gap-2 text-sm"><Icon name="phone" className="h-4 w-4 text-primary" /><a href={`tel:${order.phone}`} dir="ltr" className="hover:underline">{order.phone}</a></p>
            {order.email && <p className="flex items-center gap-2 text-sm"><Icon name="mail" className="h-4 w-4 text-primary" /><a href={`mailto:${order.email}`} className="break-all hover:underline">{order.email}</a></p>}
          </section>

          <section className="card card-pad space-y-3" aria-labelledby="deliv-title">
            <h2 id="deliv-title" className="!text-2xl">Delivery</h2>
            <p className="flex items-start gap-2 text-sm"><Icon name="calendar" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><strong>{formatDay(order.deliveryDate)}</strong></p>
            <p className="flex items-start gap-2 text-sm"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{order.address}<br />{order.cityName}</span></p>
            {order.notes && <p className="rounded-xl bg-primary/5 p-3 text-sm"><strong>Note:</strong> {order.notes}</p>}
            <p className="text-sm text-ink/70">Payment method: {order.paymentMethod === "cod" ? t("payment.cod") : t("payment.online")}</p>
          </section>
        </div>
      </div>
    </>
  );
}
