import Link from "next/link";
import { Filters, type FilterValues } from "@/components/shop/Filters";
import { ProductGrid } from "@/components/shop/ProductCard";
import { Pagination } from "@/components/ui/Pagination";
import { Icon } from "@/components/ui/Icon";
import { listProducts, getTaxonomy, type SortKey } from "@/server/services/catalog";
import { t } from "@/i18n";

type SP = { [key: string]: string | string[] | undefined };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const SORTS: SortKey[] = ["newest", "price_asc", "price_desc", "best"];

/** Reads filter values from the URL, with safe defaults. */
export function parseFilters(sp: SP, lockedCategory?: string): FilterValues {
  const sort = first(sp.sort);
  return {
    q: first(sp.q).slice(0, 80),
    category: lockedCategory ?? first(sp.category).slice(0, 120),
    occasion: first(sp.occasion).slice(0, 120),
    scent: first(sp.scent).slice(0, 120),
    min: first(sp.min).slice(0, 10),
    max: first(sp.max).slice(0, 10),
    sort: SORTS.includes(sort as SortKey) ? sort : "newest",
    instock: first(sp.instock) === "1",
    sale: first(sp.sale) === "1",
  };
}

const num = (s: string) => (s !== "" && Number.isFinite(Number(s)) && Number(s) >= 0 ? Number(s) : undefined);

/** Filter sidebar + product grid + pagination. Shared by /shop, /category/[slug] and /gifts. */
export async function CatalogView({
  basePath, searchParams, lockedCategory, giftsOnly = false,
}: { basePath: string; searchParams: SP; lockedCategory?: string; giftsOnly?: boolean }) {
  const f = parseFilters(searchParams, lockedCategory);
  const page = Number(first(searchParams.page)) || 1;

  const [result, taxonomy] = await Promise.all([
    listProducts({
      q: f.q, category: f.category || undefined, occasion: f.occasion || undefined, scent: f.scent || undefined,
      minPrice: num(f.min), maxPrice: num(f.max), sort: f.sort as SortKey, page, pageSize: 12,
      giftsOnly, inStockOnly: f.instock, onSaleOnly: f.sale,
    }),
    getTaxonomy(),
  ]);

  const categories = giftsOnly ? taxonomy.categories.filter((c) => c.isGift) : taxonomy.categories;
  const activeCount = [f.q, lockedCategory ? "" : f.category, f.occasion, f.scent, f.min, f.max, f.instock ? "1" : "", f.sale ? "1" : ""].filter(Boolean).length;

  // URL params that survive a page change (the locked category lives in the path).
  const keep: Record<string, string | undefined> = {
    q: f.q || undefined, category: lockedCategory ? undefined : f.category || undefined, occasion: f.occasion || undefined,
    scent: f.scent || undefined, min: f.min || undefined, max: f.max || undefined,
    sort: f.sort !== "newest" ? f.sort : undefined, instock: f.instock ? "1" : undefined, sale: f.sale ? "1" : undefined,
  };

  // Removable chips for the active filters.
  const chips: { label: string; param: string }[] = [];
  if (f.q) chips.push({ label: `“${f.q}”`, param: "q" });
  if (!lockedCategory && f.category) chips.push({ label: taxonomy.categories.find((c) => c.slug === f.category)?.name ?? f.category, param: "category" });
  if (f.occasion) chips.push({ label: taxonomy.occasions.find((o) => o.slug === f.occasion)?.name ?? f.occasion, param: "occasion" });
  if (f.scent) chips.push({ label: taxonomy.scents.find((s) => s.slug === f.scent)?.name ?? f.scent, param: "scent" });
  if (f.min || f.max) chips.push({ label: `${f.min || "0"} – ${f.max || "∞"} JOD`, param: "price" });
  if (f.instock) chips.push({ label: t("filters.inStock"), param: "instock" });
  if (f.sale) chips.push({ label: t("filters.onSale"), param: "sale" });

  const without = (param: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) {
      if (!v) continue;
      if (param === "price" && (k === "min" || k === "max")) continue;
      if (k === param) continue;
      sp.set(k, v);
    }
    return sp.size ? `${basePath}?${sp}` : basePath;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label={t("filters.title")}>
        <Filters
          basePath={basePath}
          values={f}
          categories={categories}
          occasions={taxonomy.occasions}
          scents={taxonomy.scents}
          priceBounds={result.priceBounds}
          hideCategory={Boolean(lockedCategory)}
          activeCount={activeCount}
        />
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-live="polite">
          <p className="me-2 text-sm font-semibold text-ink/70">{t(result.total === 1 ? "catalog.resultOne" : "catalog.results", { count: result.total })}</p>
          {chips.map((c) => (
            <Link key={c.param} href={without(c.param)} className="chip !min-h-8 !px-3 !py-1 !text-xs" aria-label={t("filters.remove", { name: c.label })}>
              {c.label} <Icon name="x" className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>

        {result.items.length === 0 ? (
          <div className="card card-pad py-14 text-center">
            <p className="font-serif text-3xl">{t("catalog.emptyTitle")}</p>
            <p className="mx-auto mt-2 max-w-md text-ink/70">{t("catalog.emptyText")}</p>
            {activeCount > 0 && <Link href={basePath} className="btn btn-primary mt-6">{t("filters.clear")}</Link>}
          </div>
        ) : (
          <ProductGrid products={result.items} priorityCount={4} />
        )}

        <Pagination basePath={basePath} params={keep} page={result.page} pages={result.pages} />
      </div>
    </div>
  );
}

export function hasActiveFilters(sp: SP): boolean {
  return ["q", "category", "occasion", "scent", "min", "max", "instock", "sale", "page", "sort"].some((k) => first(sp[k]) !== "");
}
