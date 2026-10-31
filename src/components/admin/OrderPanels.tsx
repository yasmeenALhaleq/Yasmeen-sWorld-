import { OrderStatusForm, PaymentStatusForm } from "@/components/admin/OrderForms";
import { t, type MessageKey } from "@/i18n";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

/** Right-hand column cards on the order page: status + payment. */
export function OrderPaymentAndStatus({ orderId, status, paymentStatus }: { orderId: number; status: OrderStatus; paymentStatus: PaymentStatus }) {
  return (
    <>
      <section className="card card-pad space-y-3" aria-labelledby="status-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="status-title" className="!text-2xl">Status</h2>
          <span className={`badge ${status === "delivered" ? "badge-ok" : status === "cancelled" ? "badge-bad" : "badge-warn"}`}>{t(`status.${status}` as MessageKey)}</span>
        </div>
        <OrderStatusForm orderId={orderId} status={status} />
      </section>
      <section className="card card-pad" aria-labelledby="pay-title">
        <h2 id="pay-title" className="mb-3 !text-2xl">Payment</h2>
        <PaymentStatusForm orderId={orderId} status={paymentStatus} />
      </section>
    </>
  );
}
