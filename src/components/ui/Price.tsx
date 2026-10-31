import { formatMoney } from "@/lib/money";
import { t } from "@/i18n";

/** Selling price with the old price struck through when the product is on sale. */
export function Price({
  price,
  finalPrice,
  percentOff = 0,
  from = false,
  className = "",
  large = false,
}: {
  price: number;
  finalPrice: number;
  percentOff?: number;
  from?: boolean;
  className?: string;
  large?: boolean;
}) {
  const onSale = percentOff > 0 && finalPrice < price;
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 ${className}`}>
      {from && <span className="text-xs font-semibold uppercase tracking-wider text-ink/60">{t("price.from")}</span>}
      {/* <bdi> keeps "9.000 JOD" in the same order when the page is right-to-left */}
      <span className={`${large ? "text-2xl sm:text-3xl" : "text-base"} font-extrabold ${onSale ? "text-red-800" : "text-ink"}`}>
        <bdi>{formatMoney(finalPrice)}</bdi>
      </span>
      {onSale && (
        <>
          <span className="sr-only">{t("price.was")}</span>
          <s className={`${large ? "text-base" : "text-sm"} text-ink/55`}><bdi>{formatMoney(price)}</bdi></s>
        </>
      )}
    </p>
  );
}

export function SaleBadge({ percentOff, className = "" }: { percentOff: number; className?: string }) {
  if (percentOff <= 0) return null;
  return <span className={`badge badge-sale ${className}`}>-{percentOff}%</span>;
}
