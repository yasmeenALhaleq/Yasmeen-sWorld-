"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { ProductImage } from "@/components/shop/ProductImage";
import { useCart } from "@/components/shop/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { t } from "@/i18n";
import type { ProductCardData, ProductVariantData } from "@/lib/types";

export function ProductQuickView({
  product,
  priority,
  children,
}: {
  product: ProductCardData;
  priority: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const initialVariant = product.quickVariants.find((variant) => variant.inStock) ?? null;
  const [variantId, setVariantId] = useState<number | null>(initialVariant?.id ?? null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const { addProduct } = useCart();

  const selectedVariant = product.quickVariants.find((variant) => variant.id === variantId) ?? null;
  const hasVariants = product.quickVariants.length > 0;
  const available = hasVariants
    ? selectedVariant?.stock ?? null
    : product.trackStock ? Math.max(product.stockQuantity, 0) : null;
  const maxQuantity = Math.min(99, available ?? 99);
  const inStock = hasVariants ? selectedVariant?.inStock === true : product.inStock;
  const shownPrice = selectedVariant ?? product;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) setOpen(false);
  }

  function selectVariant(variant: ProductVariantData) {
    setVariantId(variant.id);
    setQuantity(1);
  }

  function addToCart() {
    if (!inStock || (hasVariants && !selectedVariant)) return;
    addProduct(product.id, selectedVariant?.id ?? null, Math.min(quantity, maxQuantity));
    setOpen(false);
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={product.name}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="flex flex-1 cursor-pointer flex-col text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {children}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        onClose={() => setOpen(false)}
        onClick={handleBackdropClick}
        className="product-quick-view fixed inset-x-0 bottom-0 m-0 h-[50dvh] max-h-[50dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-0 bg-page p-0 text-ink shadow-2xl sm:left-1/2 sm:right-auto sm:w-[min(100%,42rem)] sm:-translate-x-1/2"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-primary/15 px-4 py-2.5 sm:px-6">
            <div className="min-w-0">
              {product.categoryName && <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-accent">{product.categoryName}</p>}
              <h2 id={headingId} className="truncate !text-lg sm:!text-xl">{product.name}</h2>
            </div>
            <button type="button" className="btn btn-ghost !min-h-10 !w-10 !px-0" onClick={() => setOpen(false)} aria-label={t("common.close")}>
              <Icon name="x" className="h-5 w-5" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 gap-3 overflow-y-auto p-4 sm:gap-5 sm:px-6">
            <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl sm:h-36 sm:w-32">
              <ProductImage image={product.image} alt={product.name} priority={priority} className="h-full w-full" sizes="8rem" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Price
                price={shownPrice.price}
                finalPrice={shownPrice.finalPrice}
                percentOff={shownPrice.percentOff}
                from={!selectedVariant && product.priceFrom}
                className="!gap-x-1"
              />
              {product.shortDescription && <p className="line-clamp-3 text-sm leading-snug text-ink/75">{product.shortDescription}</p>}

              {hasVariants && (
                <fieldset>
                  <legend className="mb-1 text-xs font-bold">{product.optionName}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {product.quickVariants.map((variant) => (
                      <label key={variant.id} className={`chip !min-h-8 !px-3 !py-1 !text-xs ${!variant.inStock ? "opacity-50" : ""}`} aria-pressed={variant.id === variantId}>
                        <input
                          type="radio"
                          name={`quick-view-variant-${product.id}`}
                          value={variant.id}
                          checked={variant.id === variantId}
                          disabled={!variant.inStock}
                          className="sr-only"
                          onChange={() => selectVariant(variant)}
                        />
                        {variant.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <p className="text-xs font-semibold" role="status">
                {!inStock
                  ? t("product.soldOut")
                  : available !== null && available <= product.lowStockThreshold
                    ? t("product.onlyLeft", { count: available })
                    : t("product.inStock")}
              </p>
              <Link href={`/product/${product.slug}`} className="inline-flex text-xs font-bold text-primary underline underline-offset-2">
                {t("product.viewDetails")}
              </Link>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-primary/15 bg-page px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
            <div className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-surface" role="group" aria-label={t("product.quantity")}>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || !inStock} aria-label={t("product.decrease")}>
                <Icon name="minus" className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-extrabold" aria-live="polite">{inStock ? Math.min(quantity, maxQuantity) : 0}</span>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} disabled={!inStock || quantity >= maxQuantity} aria-label={t("product.increase")}>
                <Icon name="plus" className="h-4 w-4" />
              </button>
            </div>
            <button type="button" className="btn btn-primary min-h-10 flex-1 px-3 sm:px-6" onClick={addToCart} disabled={!inStock}>
              <Icon name="bag" className="h-4 w-4" /> {inStock ? t("product.addToCart") : t("product.soldOut")}
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
