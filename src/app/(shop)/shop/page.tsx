import type { Metadata } from "next";
import { CatalogView, hasActiveFilters } from "@/components/shop/CatalogView";
import { PageHero } from "@/components/shop/PageHero";
import { t } from "@/i18n";

type SP = { [key: string]: string | string[] | undefined };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return {
    title: q ? t("shop.searchTitle", { q }) : t("shop.title"),
    description: t("shop.description"),
    alternates: { canonical: "/shop" },
    // Filtered / searched views are for people, not for search engine indexes.
    robots: hasActiveFilters(sp) ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return (
    <>
      <PageHero eyebrow={t("shop.eyebrow")} title={q ? t("shop.searchTitle", { q }) : t("shop.title")} text={q ? undefined : t("shop.description")} />
      <div className="container-page section !pt-8">
        <CatalogView basePath="/shop" searchParams={sp} />
      </div>
    </>
  );
}
