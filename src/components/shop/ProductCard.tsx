import { Price, SaleBadge } from "@/components/ui/Price";
import { ProductQuickView } from "@/components/shop/ProductQuickView";
import { ProductImage } from "@/components/shop/ProductImage";
import { t } from "@/i18n";
import type { ProductCardData } from "@/lib/types";

/** A product tile for grids and carousels. */
export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-primary/10 bg-surface shadow-soft transition duration-300 hover:-translate-y-1">
      <ProductQuickView product={product} priority={priority}>
        <div className="relative block overflow-hidden">
          <ProductImage image={product.image} alt={product.name} priority={priority} className="aspect-[4/5] w-full transition duration-500 group-hover:scale-105" />
          <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
            <SaleBadge percentOff={product.percentOff} />
            {product.lowStock && <span className="badge badge-warn">{t("product.lowStock")}</span>}
          </div>
          {!product.inStock && (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/65 text-sm font-extrabold uppercase tracking-widest">{t("product.soldOut")}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          {product.categoryName && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{product.categoryName}</p>}
          <h3 className="!text-xl leading-snug">{product.name}</h3>
          <Price price={product.price} finalPrice={product.finalPrice} percentOff={product.percentOff} from={product.priceFrom} className="mt-auto pt-1" />
        </div>
      </ProductQuickView>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}><ProductCard product={p} priority={i < priorityCount} /></li>
      ))}
    </ul>
  );
}
