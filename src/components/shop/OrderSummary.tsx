import { formatMoney } from "@/lib/money";
import { t } from "@/i18n";
import type { CartQuote } from "@/lib/types";

/** Subtotal, coupon, delivery and total lines for a quote. */
export function QuoteTotals({ quote, freeThreshold, estimate = false }: { quote: CartQuote; freeThreshold: number; estimate?: boolean }) {
  const row = (label: React.ReactNode, value: React.ReactNode, strong = false, tone = "") => (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-primary/15 pt-3 text-xl font-extrabold" : "text-sm"} ${tone}`}>
      <dt>{label}</dt>
      <dd className="text-end">{value}</dd>
    </div>
  );
  const progress = freeThreshold > 0 ? Math.min(100, Math.round(((quote.subtotal - (quote.coupon?.discount ?? 0)) / freeThreshold) * 100)) : 0;

  return (
    <div className="space-y-4">
      <dl className="space-y-2">
        {row(t("summary.subtotal"), formatMoney(quote.subtotal))}
        {quote.savings > 0 && row(t("summary.savings"), `- ${formatMoney(quote.savings)}`, false, "text-emerald-800 font-semibold")}
        {quote.coupon && row(t("summary.coupon", { code: quote.coupon.code }), `- ${formatMoney(quote.coupon.discount)}`, false, "text-emerald-800 font-semibold")}
        {row(
          t("summary.delivery"),
          quote.deliveryFee === null ? <span className="text-ink/60">{t("summary.deliveryLater")}</span> : quote.deliveryFee === 0 ? t("summary.free") : formatMoney(quote.deliveryFee),
        )}
        {row(estimate ? t("summary.estimatedTotal") : t("summary.total"), formatMoney(quote.total), true)}
      </dl>

      {freeThreshold > 0 && quote.freeDeliveryRemaining !== null && (
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t("summary.freeDeliveryAway", { amount: formatMoney(quote.freeDeliveryRemaining) })}</p>
          <div className="h-2 overflow-hidden rounded-full bg-primary/15" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("summary.freeDeliveryProgress")}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
