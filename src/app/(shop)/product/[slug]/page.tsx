import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductGrid } from "@/components/shop/ProductCard";
import { ProductPurchase } from "@/components/shop/ProductPurchase";
import { Icon } from "@/components/ui/Icon";
import { SaleBadge } from "@/components/ui/Price";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getProductBySlug, getRelated } from "@/server/services/catalog";
import { getSettings } from "@/server/services/settings";
import { env } from "@/server/env";
import { stripHtml, truncate } from "@/lib/html";
import { imageUrl } from "@/lib/images";
import { t } from "@/i18n";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProductBySlug(decodeURIComponent((await params).slug));
  if (!product) return { title: t("product.notFound") };
  const description = product.metaDescription || truncate(stripHtml(product.description) || product.shortDescription, 155);
  return {
    title: product.metaTitle || product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.metaTitle || product.name,
      description,
      images: product.image ? [{ url: imageUrl(product.image.key, 1600) }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const slug = decodeURIComponent((await params).slug);
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [settings, related] = await Promise.all([getSettings(), getRelated(product, 4)]);
  const whatsappUrl = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(t("product.whatsappText", { name: product.name, url: `${env.siteUrl}/product/${product.slug}` }))}`
    : "";

  // Structured data so search engines can show price and availability.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: truncate(stripHtml(product.description) || product.shortDescription, 300),
    image: product.images.map((i) => `${env.siteUrl}${imageUrl(i.key, 1600)}`),
    category: product.categoryName ?? undefined,
    brand: { "@type": "Brand", name: settings.storeName },
    offers: {
      "@type": "Offer",
      url: `${env.siteUrl}/product/${product.slug}`,
      priceCurrency: "JOD",
      price: product.finalPrice.toFixed(3),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const sections: { id: string; title: string; body: React.ReactNode }[] = [];
  if (product.description) {
    sections.push({ id: "desc", title: t("product.description"), body: <div className="rich" dangerouslySetInnerHTML={{ __html: product.description }} /> });
  }
  if (product.ingredients) {
    sections.push({ id: "ing", title: t("product.ingredients"), body: <p className="whitespace-pre-line">{product.ingredients}</p> });
  }
  if (product.howToUse) {
    sections.push({ id: "use", title: t("product.howToUse"), body: <p className="whitespace-pre-line">{product.howToUse}</p> });
  }

  return (
    <div className="container-page py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label={t("product.breadcrumb")} className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-ink/70">
        <Link href="/" className="hover:text-primary">{t("nav.home")}</Link>
        <Icon name="chevron-right" className="h-3.5 w-3.5 rtl:rotate-180" />
        <Link href="/shop" className="hover:text-primary">{t("nav.shop")}</Link>
        {product.categorySlug && (
          <>
            <Icon name="chevron-right" className="h-3.5 w-3.5 rtl:rotate-180" />
            <Link href={`/category/${product.categorySlug}`} className="hover:text-primary">{product.categoryName}</Link>
          </>
        )}
        <Icon name="chevron-right" className="h-3.5 w-3.5 rtl:rotate-180" />
        <span aria-current="page" className="font-semibold text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery
          images={product.images}
          name={product.name}
          badge={product.percentOff > 0 ? <SaleBadge percentOff={product.percentOff} className="absolute start-4 top-4 !px-3 !py-1 !text-sm" /> : undefined}
        />

        <div className="space-y-6">
          <header>
            {product.categoryName && <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.2em] text-accent">{product.categoryName}</p>}
            <h1 className="!text-4xl sm:!text-5xl">{product.name}</h1>
            {product.shortDescription && <p className="mt-3 text-lg text-ink/80">{product.shortDescription}</p>}
          </header>

          <ProductPurchase
            productId={product.id}
            name={product.name}
            price={product.price}
            finalPrice={product.finalPrice}
            percentOff={product.percentOff}
            inStock={product.inStock}
            trackStock={product.trackStock}
            stockQuantity={product.stockQuantity}
            lowStockThreshold={product.lowStockThreshold}
            optionName={product.optionName}
            variants={product.variants}
            whatsappUrl={whatsappUrl}
          />

          <dl className="grid grid-cols-2 gap-3 text-sm">
            {product.sizeLabel && (
              <div className="rounded-2xl bg-primary/5 p-3"><dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{t("product.size")}</dt><dd className="font-bold">{product.sizeLabel}</dd></div>
            )}
            {product.scentName && (
              <div className="rounded-2xl bg-primary/5 p-3"><dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{t("product.scent")}</dt><dd className="font-bold">{product.scentName}</dd></div>
            )}
            {product.occasions.length > 0 && (
              <div className="col-span-2 rounded-2xl bg-primary/5 p-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{t("product.suitedFor")}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {product.occasions.map((o) => (
                    <Link key={o.id} href={`/gifts?occasion=${o.slug}`} className="badge badge-soft hover:bg-primary/20">{o.name}</Link>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-surface p-4 text-sm">
            <Icon name="truck" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p>{t("product.deliveryNote")}{settings.freeDeliveryThreshold > 0 && ` ${t("product.freeDelivery", { amount: settings.freeDeliveryThreshold })}`}</p>
          </div>

          {sections.length > 0 && (
            <div className="divide-y divide-primary/15 rounded-3xl border border-primary/15 bg-surface">
              {sections.map((s, i) => (
                <details key={s.id} open={i === 0} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-serif text-xl font-semibold">
                    {s.title}
                    <Icon name="chevron-down" className="h-5 w-5 transition group-open:rotate-180" />
                  </summary>
                  <div className="pt-3 text-ink/85">{s.body}</div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 sm:mt-24" aria-labelledby="related-title">
          <SectionHeading id="related-title" title={t("product.related")} />
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
