"use client";

import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { ProductImage } from "@/components/shop/ProductImage";
import { Icon } from "@/components/ui/Icon";
import { formatMoney } from "@/lib/money";
import { t } from "@/i18n";
import type { PricedLine } from "@/lib/types";

/** The priced items of the cart, with quantity steppers and remove buttons. */
export function CartLines({ lines, editable = true }: { lines: PricedLine[]; editable?: boolean }) {
  const cart = useCart();

  return (
    <ul className="divide-y divide-primary/10">
      {lines.map((line) => {
        const max = Math.min(line.kind === "gift" ? 20 : 99, line.maxQty ?? 99);
        const onSale = line.originalUnitPrice > line.unitPrice;
        return (
          <li key={line.id} className="flex gap-3 py-4 sm:gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-24">
              <ProductImage image={line.image} alt="" sizes="96px" className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {line.slug ? (
                    <Link href={`/product/${line.slug}`} className="font-serif text-xl font-semibold leading-tight hover:text-primary">{line.name}</Link>
                  ) : (
                    <p className="font-serif text-xl font-semibold leading-tight">{line.name}</p>
                  )}
                  {line.variantLabel && <p className="text-sm text-ink/70">{line.variantLabel}</p>}
                </div>
                <p className="shrink-0 text-end font-extrabold">{formatMoney(line.lineTotal)}</p>
              </div>

              {line.gift && (
                <details className="mt-1 text-sm text-ink/75">
                  <summary className="cursor-pointer font-semibold text-primary">{t("cart.giftContents", { count: line.gift.items.reduce((n, i) => n + i.qty, 0) })}</summary>
                  <ul className="mt-1 list-disc space-y-0.5 ps-5">
                    {line.gift.items.map((i, idx) => <li key={idx}>{i.qty} × {i.name}</li>)}
                  </ul>
                  {line.gift.occasion && <p className="mt-1">{t("builder.occasion")}: {line.gift.occasion}</p>}
                  {line.gift.wrapping && <p>{t("builder.wrapping")}: {line.gift.wrapping}</p>}
                  {line.gift.ribbon && <p>{t("builder.ribbon")}: {line.gift.ribbon.name}</p>}
                  {line.gift.cardMessage && <p className="italic">“{line.gift.cardMessage}”</p>}
                </details>
              )}

              <p className="mt-1 text-sm">
                {onSale && <s className="me-2 text-ink/50">{formatMoney(line.originalUnitPrice)}</s>}
                <span className={onSale ? "font-bold text-red-800" : "text-ink/75"}>{formatMoney(line.unitPrice)}</span>
              </p>

              {line.issues.length > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-red-800" role="alert">
                  <Icon name="alert" className="h-4 w-4 shrink-0" /> {line.issues.join(" · ")}
                </p>
              )}

              {editable && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="inline-flex items-center rounded-full border-2 border-primary/30 bg-surface" role="group" aria-label={t("product.quantity")}>
                    <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" disabled={line.qty <= 1}
                      onClick={() => cart.setQty(line.id, line.qty - 1)} aria-label={t("product.decrease")}><Icon name="minus" className="h-4 w-4" /></button>
                    <span className="w-8 text-center font-extrabold" aria-live="polite">{line.qty}</span>
                    <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" disabled={line.qty >= max}
                      onClick={() => cart.setQty(line.id, line.qty + 1)} aria-label={t("product.increase")}><Icon name="plus" className="h-4 w-4" /></button>
                  </div>
                  <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70 underline underline-offset-2 hover:text-red-800" onClick={() => cart.remove(line.id)}>
                    <Icon name="trash" className="h-4 w-4" /> {t("common.remove")}
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
