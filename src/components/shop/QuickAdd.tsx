"use client";

import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";

/** Add-to-cart on product cards. Products with options go to the product page instead. */
export function QuickAdd({ productId, slug, hasVariants, inStock, name }: {
  productId: number; slug: string; hasVariants: boolean; inStock: boolean; name: string;
}) {
  const { addProduct } = useCart();
  if (!inStock) {
    return <span className="btn btn-sm btn-soft pointer-events-none w-full opacity-60" aria-disabled="true">{t("product.soldOut")}</span>;
  }
  if (hasVariants) {
    return <Link href={`/product/${slug}`} className="btn btn-sm btn-outline w-full" aria-label={t("product.chooseOptionsFor", { name })}>{t("product.chooseOptions")}</Link>;
  }
  return (
    <button type="button" className="btn btn-sm btn-primary w-full" onClick={() => addProduct(productId, null)} aria-label={t("product.addNamed", { name })}>
      <Icon name="bag" className="h-4 w-4" /> {t("product.addToCart")}
    </button>
  );
}
