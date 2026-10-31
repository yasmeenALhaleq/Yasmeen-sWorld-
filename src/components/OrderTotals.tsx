import { formatMoney } from "@/lib/money";
import { t } from "@/i18n";
import type { OrderData } from "@/lib/types";

/** Subtotal / discounts / delivery / total block. */
export function OrderTotals({ order }: { order: Pick<OrderData, "subtotal" | "savings" | "couponCode" | "couponDiscount" | "deliveryFee" | "total"> }) {
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-primary/15 pt-2 text-lg font-extrabold" : "text-sm"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-1.5">
      {row(t("email.order.subtotal"), formatMoney(order.subtotal))}
      {order.savings > 0 && row(t("email.order.savings"), formatMoney(order.savings))}
      {order.couponDiscount > 0 && row(t("email.order.coupon", { code: order.couponCode ?? "" }), `- ${formatMoney(order.couponDiscount)}`)}
      {row(t("email.order.deliveryFee"), order.deliveryFee === 0 ? t("email.order.free") : formatMoney(order.deliveryFee))}
      {row(t("email.order.total"), formatMoney(order.total), true)}
    </dl>
  );
}
