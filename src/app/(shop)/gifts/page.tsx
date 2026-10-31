import type { Metadata } from "next";
import Link from "next/link";
import { CatalogView, hasActiveFilters } from "@/components/shop/CatalogView";
import { PageHero } from "@/components/shop/PageHero";
import { Icon } from "@/components/ui/Icon";
import { getTaxonomy } from "@/server/services/catalog";
import { t } from "@/i18n";

type SP = { [key: string]: string | string[] | undefined };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const occasion = (await getTaxonomy()).occasions.find((o) => o.slug === first(sp.occasion));
  return {
    title: occasion ? t("gifts.titleFor", { occasion: occasion.name }) : t("gifts.title"),
    description: t("gifts.description"),
    alternates: { canonical: "/gifts" },
    robots: hasActiveFilters(sp) && !occasion ? { index: false, follow: true } : undefined,
  };
}

/** Ready-made gifts, filterable by occasion. */
export default async function GiftsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const taxonomy = await getTaxonomy();
  const current = first(sp.occasion) ?? "";
  const occasion = taxonomy.occasions.find((o) => o.slug === current);

  return (
    <>
      <PageHero eyebrow={t("gifts.eyebrow")} title={occasion ? t("gifts.titleFor", { occasion: occasion.name }) : t("gifts.title")} text={t("gifts.description")} />
      <div className="container-page section !pt-8">
        <nav aria-label={t("filters.occasion")} className="mb-6">
          <ul className="flex flex-wrap justify-center gap-2">
            <li><Link href="/gifts" className="chip" aria-current={!current ? "true" : undefined}>{t("gifts.allOccasions")}</Link></li>
            {taxonomy.occasions.map((o) => (
              <li key={o.id}><Link href={`/gifts?occasion=${o.slug}`} className="chip" aria-current={current === o.slug ? "true" : undefined}>{o.name}</Link></li>
            ))}
          </ul>
        </nav>

        <div className="card card-pad mb-8 flex flex-col items-center justify-between gap-4 bg-primary/5 sm:flex-row">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"><Icon name="gift" /></span>
            <div>
              <p className="font-serif text-2xl font-semibold">{t("gifts.buildCta.title")}</p>
              <p className="text-sm text-ink/75">{t("gifts.buildCta.text")}</p>
            </div>
          </div>
          <Link href={occasion ? `/gifts/build?occasion=${occasion.slug}` : "/gifts/build"} className="btn btn-primary shrink-0">{t("gifts.buildCta.button")}</Link>
        </div>

        <CatalogView basePath="/gifts" searchParams={sp} giftsOnly />
      </div>
    </>
  );
}
