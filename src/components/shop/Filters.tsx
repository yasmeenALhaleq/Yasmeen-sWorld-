"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";

export interface FilterValues {
  q: string;
  category: string;
  occasion: string;
  scent: string;
  min: string;
  max: string;
  sort: string;
  instock: boolean;
  sale: boolean;
}

interface Option { slug: string; name: string }

/**
 * Filter + sort panel. It is a plain GET form (so the URL is shareable and it
 * works without JavaScript); selects and checkboxes also submit on change.
 * On phones it folds away behind a "Filters" button.
 */
export function Filters({
  basePath, values, categories, occasions, scents, priceBounds, hideCategory, activeCount,
}: {
  basePath: string;
  values: FilterValues;
  categories: Option[];
  occasions: Option[];
  scents: Option[];
  priceBounds: { min: number; max: number };
  hideCategory?: boolean;
  activeCount: number;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const submit = () => form.current?.requestSubmit();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <button type="button" className="btn btn-soft btn-sm" aria-expanded={open} aria-controls="filter-panel" onClick={() => setOpen((o) => !o)}>
          <Icon name="filter" className="h-4 w-4" /> {t("filters.title")}{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>

      <form ref={form} id="filter-panel" action={basePath} method="get" role="search"
        className={`card card-pad space-y-4 ${open ? "block" : "hidden"} lg:block`}
        onChange={(e) => { const el = e.target as unknown as HTMLElement; if (el.tagName === "SELECT" || (el as HTMLInputElement).type === "checkbox") submit(); }}>
        <div>
          <label htmlFor="f-q" className="label">{t("filters.search")}</label>
          <input id="f-q" name="q" type="search" defaultValue={values.q} className="input" placeholder={t("nav.searchPlaceholder")} />
        </div>

        {!hideCategory && (
          <div>
            <label htmlFor="f-cat" className="label">{t("filters.category")}</label>
            <select id="f-cat" name="category" defaultValue={values.category} className="input">
              <option value="">{t("filters.all")}</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="f-occ" className="label">{t("filters.occasion")}</label>
          <select id="f-occ" name="occasion" defaultValue={values.occasion} className="input">
            <option value="">{t("filters.all")}</option>
            {occasions.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="f-scent" className="label">{t("filters.scent")}</label>
          <select id="f-scent" name="scent" defaultValue={values.scent} className="input">
            <option value="">{t("filters.all")}</option>
            {scents.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>

        <fieldset>
          <legend className="label">{t("filters.price")}</legend>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="f-min">{t("filters.min")}</label>
            <input id="f-min" name="min" type="number" inputMode="decimal" min={0} step="any" defaultValue={values.min} placeholder={String(priceBounds.min)} className="input" />
            <span aria-hidden="true">–</span>
            <label className="sr-only" htmlFor="f-max">{t("filters.max")}</label>
            <input id="f-max" name="max" type="number" inputMode="decimal" min={0} step="any" defaultValue={values.max} placeholder={String(priceBounds.max)} className="input" />
          </div>
        </fieldset>

        <div>
          <label htmlFor="f-sort" className="label">{t("filters.sort")}</label>
          <select id="f-sort" name="sort" defaultValue={values.sort} className="input">
            <option value="newest">{t("sort.newest")}</option>
            <option value="best">{t("sort.best")}</option>
            <option value="price_asc">{t("sort.priceAsc")}</option>
            <option value="price_desc">{t("sort.priceDesc")}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="instock" value="1" defaultChecked={values.instock} className="checkbox" /> {t("filters.inStock")}
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="sale" value="1" defaultChecked={values.sale} className="checkbox" /> {t("filters.onSale")}
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn btn-primary btn-sm">{t("filters.apply")}</button>
          {activeCount > 0 && <a href={basePath} className="btn btn-ghost btn-sm">{t("filters.clear")}</a>}
        </div>
      </form>
    </div>
  );
}
