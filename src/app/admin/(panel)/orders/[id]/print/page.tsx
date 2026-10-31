import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { OrderItems } from "@/components/OrderItems";
import { OrderTotals } from "@/components/OrderTotals";
import { getOrderById } from "@/server/services/orders";
import { getSettings } from "@/server/services/settings";
import { formatDateTime, formatDay } from "@/lib/time";
import { t } from "@/i18n";

export const metadata = { title: "Order slip" };

/** Printable order slip: what to pack, where to deliver, and the gift card text. */
export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) notFound();
  const [order, settings] = await Promise.all([getOrderById(orderId), getSettings()]);
  if (!order) notFound();

  const cardMessages = [
    ...(order.giftMessage ? [order.giftMessage] : []),
    ...order.items.flatMap((i) => (i.gift?.cardMessage ? [i.gift.cardMessage] : [])),
  ];

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/admin/orders/${order.id}`} className="btn btn-ghost btn-sm">Back to the order</Link>
        <PrintButton label="Print slip" />
      </div>

      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <p className="font-serif text-3xl font-bold">{settings.storeName}</p>
          {settings.contactPhone && <p className="text-sm">{settings.contactPhone}</p>}
        </div>
        <div className="text-end">
          <p className="text-xl font-extrabold">{order.orderNumber}</p>
          <p className="text-sm">Placed {formatDateTime(new Date(order.createdAt))}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-6 text-sm">
        <div>
          <h2 className="mb-1 font-sans !text-xs font-bold uppercase tracking-widest">Deliver to</h2>
          <p className="text-base font-bold">{order.customerName}</p>
          <p dir="ltr" className="text-start">{order.phone}</p>
          <p className="mt-1">{order.address}</p>
          <p className="font-bold">{order.cityName}</p>
        </div>
        <div>
          <h2 className="mb-1 font-sans !text-xs font-bold uppercase tracking-widest">Delivery date</h2>
          <p className="text-base font-bold">{formatDay(order.deliveryDate)}</p>
          <p className="mt-1">Payment: {order.paymentMethod === "cod" ? t("payment.cod") : t("payment.online")} ({t(`payment.${order.paymentStatus}`)})</p>
          {order.notes && <p className="mt-1">Note: {order.notes}</p>}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-1 font-sans !text-xs font-bold uppercase tracking-widest">Items to pack</h2>
        <OrderItems items={order.items} showImages={false} compact />
        <div className="ms-auto mt-3 max-w-xs"><OrderTotals order={order} /></div>
      </section>

      {cardMessages.length > 0 && (
        <section className="mt-6 rounded-lg border-2 border-dashed border-black p-4">
          <h2 className="mb-2 font-sans !text-xs font-bold uppercase tracking-widest">Gift card message</h2>
          {cardMessages.map((m, i) => <p key={i} className="whitespace-pre-line text-lg italic">“{m}”</p>)}
        </section>
      )}
    </div>
  );
}
