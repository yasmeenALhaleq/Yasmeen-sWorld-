import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView, hasActiveFilters } from "@/components/shop/CatalogView";
import { PageHero } from "@/components/shop/PageHero";
import { getTaxonomy } from "@/server/services/catalog";
import { t } from "@/i18n";

type SP = { [key: string]: string | string[] | undefined };

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getTaxonomy()).categories.find((c) => c.slug === decodeURIComponent(slug));
  if (!category) return {};
  return {
    title: category.name,
    description: category.description || t("category.description", { name: category.name }),
    alternates: { canonical: `/category/${category.slug}` },
    robots: hasActiveFilters(await searchParams) ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const category = (await getTaxonomy()).categories.find((c) => c.slug === decodeURIComponent(slug));
  if (!category) notFound();

  return (
    <>
      <PageHero eyebrow={t("category.eyebrow")} title={category.name} text={category.description} />
      <div className="container-page section !pt-8">
        <CatalogView basePath={`/category/${category.slug}`} lockedCategory={category.slug} searchParams={await searchParams} />
      </div>
    </>
  );
}
