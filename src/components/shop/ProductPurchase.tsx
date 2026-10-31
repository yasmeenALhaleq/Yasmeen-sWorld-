"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/components/shop/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { t } from "@/i18n";
import type { ProductVariantData } from "@/lib/types";

interface Props {
  productId: number;
  name: string;
  price: number;
  finalPrice: number;
  percentOff: number;
  inStock: boolean;
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  optionName: string;
  variants: ProductVariantData[];
  whatsappUrl: string;
}

/** Option picker, quantity stepper and Add to cart. */
export function ProductPurchase(p: Props) {
  const { addProduct } = useCart();
  const hasVariants = p.variants.length > 0;
  const firstAvailable = p.variants.find((v) => v.inStock) ?? null;
  const [variantId, setVariantId] = useState<number | null>(firstAvailable?.id ?? null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");

  const variant = useMemo(() => p.variants.find((v) => v.id === variantId) ?? null, [p.variants, variantId]);
  const shown = hasVariants && variant
    ? { price: variant.price, finalPrice: variant.finalPrice, percentOff: variant.percentOff }
    : { price: p.price, finalPrice: p.finalPrice, percentOff: p.percentOff };

  // Units that can be ordered right now (null = unlimited).
  const available: number | null = hasVariants ? (variant ? variant.stock : null) : p.trackStock ? Math.max(p.stockQuantity, 0) : null;
  const inStock = hasVariants ? (variant ? variant.inStock : p.inStock) : p.inStock;
  const maxQty = Math.min(99, available ?? 99);
  const low = inStock && available !== null && available <= p.lowStockThreshold;

  function add() {
    if (hasVariants && !variant) { setMessage(t("product.chooseFirst", { option: p.optionName.toLowerCase() })); return; }
    setMessage("");
    addProduct(p.productId, variant?.id ?? null, Math.min(qty, maxQty));
  }

  return (
    <div className="space-y-5">
      <Price {...shown} from={false} large />

      {hasVariants && (
        <fieldset>
          <legend className="label">{p.optionName}</legend>
          <div className="flex flex-wrap gap-2">
            {p.variants.map((v) => (
              <label key={v.id} className={`chip cursor-pointer ${!v.inStock ? "opacity-50" : ""}`} aria-pressed={v.id === variantId}>
                <input type="radio" name="variant" value={v.id} checked={v.id === variantId} className="sr-only"
                  onChange={() => { setVariantId(v.id); setQty(1); setMessage(""); }} />
                {v.label}
                {!v.inStock && <span className="text-xs">({t("product.soldOut")})</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="flex items-center gap-2 text-sm font-bold" role="status">
        {!inStock ? (
          <><span className="h-2.5 w-2.5 rounded-full bg-red-700" /> {t("product.outOfStock")}</>
        ) : low ? (
          <><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {t("product.onlyLeft", { count: available ?? 0 })}</>
        ) : (
          <><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> {t("product.inStock")}</>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-full border-2 border-primary/30 bg-surface" role="group" aria-label={t("product.quantity")}>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || !inStock} aria-label={t("product.decrease")}><Icon name="minus" className="h-4 w-4" /></button>
          <span className="w-10 text-center text-lg font-extrabold" aria-live="polite">{inStock ? Math.min(qty, maxQty) : 0}</span>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty || !inStock} aria-label={t("product.increase")}><Icon name="plus" className="h-4 w-4" /></button>
        </div>
        <button type="button" className="btn btn-primary btn-lg min-w-48 flex-1 sm:flex-none" onClick={add} disabled={!inStock}>
          <Icon name="bag" /> {inStock ? t("product.addToCart") : t("product.soldOut")}
        </button>
      </div>
      {message && <p className="field-error" role="alert">{message}</p>}

      {p.whatsappUrl && (
        <a href={p.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-4">
          <Icon name="whatsapp" className="h-5 w-5" /> {t("product.askWhatsapp")}
        </a>
      )}
    </div>
  );
}
