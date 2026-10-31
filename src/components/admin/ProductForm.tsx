"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveProductAction } from "@/app/admin/_actions/products";
import { ImageGalleryEditor, type GalleryImage } from "@/components/admin/ImageGalleryEditor";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { CheckboxField, FormAlert, SelectField, TextAreaField, TextField } from "@/components/ui/Fields";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { parseMoney } from "@/lib/money";
import type { ActionState } from "@/lib/entity-types";
import type { AdminProduct } from "@/server/services/admin-products";

interface Option { id: number; name: string }

interface VariantState {
  uid: string;
  id: number | null;
  label: string;
  scentId: string;
  priceDelta: string;
  stockQuantity: string;
  isActive: boolean;
}

const initial: ActionState = {};
let uidCounter = 0;
const newUid = () => `v${Date.now()}-${uidCounter++}`;

const num = (s: string): number => {
  const m = parseMoney(s.replace(/^-/, ""));
  if (m === null) return Number.NaN;
  return s.trim().startsWith("-") ? -m : m;
};
const int = (s: string): number => (/^\d+$/.test(s.trim()) ? Number(s) : Number.NaN);

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad space-y-4">
      <div>
        <h2 className="!text-2xl">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink/65">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function ProductForm({
  product, categories, occasions, scents,
}: { product: AdminProduct | null; categories: Option[]; occasions: Option[]; scents: Option[] }) {
  const [state, action] = useActionState(saveProductAction.bind(null, product?.id ?? null), initial);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [ingredients, setIngredients] = useState(product?.ingredients ?? "");
  const [howToUse, setHowToUse] = useState(product?.howToUse ?? "");
  const [sizeLabel, setSizeLabel] = useState(product?.sizeLabel ?? "");
  const [categoryId, setCategoryId] = useState(String(product?.categoryId ?? ""));
  const [scentId, setScentId] = useState(String(product?.scentId ?? ""));
  const [optionName, setOptionName] = useState(product?.optionName ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? true);
  const [stockQuantity, setStockQuantity] = useState(String(product?.stockQuantity ?? 0));
  const [lowStock, setLowStock] = useState(String(product?.lowStockThreshold ?? 5));
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [inBuilder, setInBuilder] = useState(product?.inBuilder ?? false);
  const [metaTitle, setMetaTitle] = useState(product?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(product?.metaDescription ?? "");
  const [occasionIds, setOccasionIds] = useState<number[]>(product?.occasionIds ?? []);
  const [images, setImages] = useState<GalleryImage[]>(product?.images ?? []);
  const [variants, setVariants] = useState<VariantState[]>(
    (product?.variants ?? []).map((v) => ({
      uid: newUid(), id: v.id, label: v.label, scentId: String(v.scentId ?? ""),
      priceDelta: String(v.priceDelta), stockQuantity: String(v.stockQuantity), isActive: v.isActive,
    })),
  );

  const err = state.fieldErrors ?? {};
  const hasVariants = variants.length > 0;

  const payload = useMemo(
    () =>
      JSON.stringify({
        name, slug, shortDescription, description, ingredients, howToUse, sizeLabel,
        categoryId: categoryId ? Number(categoryId) : null,
        scentId: scentId ? Number(scentId) : null,
        optionName,
        price: num(price),
        trackStock,
        stockQuantity: int(stockQuantity),
        lowStockThreshold: int(lowStock),
        isActive, isFeatured, inBuilder, metaTitle, metaDescription, occasionIds, images,
        variants: variants.map((v) => ({
          id: v.id, label: v.label, scentId: v.scentId ? Number(v.scentId) : null,
          priceDelta: v.priceDelta.trim() === "" ? 0 : num(v.priceDelta),
          stockQuantity: int(v.stockQuantity), isActive: v.isActive,
        })),
      }),
    [name, slug, shortDescription, description, ingredients, howToUse, sizeLabel, categoryId, scentId, optionName, price,
      trackStock, stockQuantity, lowStock, isActive, isFeatured, inBuilder, metaTitle, metaDescription, occasionIds, images, variants],
  );

  const updateVariant = (uid: string, patch: Partial<VariantState>) =>
    setVariants((vs) => vs.map((v) => (v.uid === uid ? { ...v, ...patch } : v)));

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="payload" value={payload} />

      <Section title="Basics">
        <TextField label="Product name" name="name_ui" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} error={err.name} autoComplete="off" />
        <TextAreaField label="Short description" name="short_ui" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} maxLength={300}
          help="One or two sentences shown on product cards and in search results." error={err.shortDescription} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Category" name="category_ui" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={err.categoryId}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Scent" name="scent_ui" value={scentId} onChange={(e) => setScentId(e.target.value)} help="Used by the scent filter." error={err.scentId}>
            <option value="">None</option>
            {scents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <TextField label="Size / weight" name="size_ui" value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} placeholder="250 g" maxLength={80} error={err.sizeLabel} />
        </div>
      </Section>

      <Section title="Pictures" hint="The first picture is the main one. Drag to reorder.">
        <ImageGalleryEditor images={images} setImages={setImages} />
        {err.images && <p className="field-error" role="alert">{err.images}</p>}
      </Section>

      <Section title="Description">
        <div>
          <span className="label" id="desc-label">Full description</span>
          <RichTextEditor value={description} onChange={setDescription} label="Full description" />
          {err.description && <p className="field-error" role="alert">{err.description}</p>}
        </div>
        <TextAreaField label="Ingredients" name="ing_ui" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={3} maxLength={4000}
          placeholder="Shea butter, sweet almond oil, ..." error={err.ingredients} />
        <TextAreaField label="How to use" name="use_ui" value={howToUse} onChange={(e) => setHowToUse(e.target.value)} rows={3} maxLength={4000} error={err.howToUse} />
      </Section>

      <Section title="Price and stock" hint="Prices are in Jordanian Dinar (JOD). To put a product on sale, create a discount; the sale price and badge then appear automatically.">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Price (JOD)" name="price_ui" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="12.500" error={err.price} autoComplete="off" />
          <TextField label="Stock quantity" name="stock_ui" type="number" min={0} value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)}
            disabled={!trackStock || hasVariants} help={hasVariants ? "Stock is set per option below." : undefined} error={err.stockQuantity} />
          <TextField label="Low-stock alert at" name="low_ui" type="number" min={0} value={lowStock} onChange={(e) => setLowStock(e.target.value)}
            disabled={!trackStock} help="Shown on the dashboard when stock falls to this number." error={err.lowStockThreshold} />
        </div>
        <CheckboxField label="Track stock" name="track_ui" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)}
          help="Turn off for made-to-order items that are always available." />
        {product && (
          <p className="text-sm">
            <Link href="/admin/discounts" className="font-semibold text-primary underline underline-offset-2">Manage discounts</Link>
            <span className="text-ink/65"> (single product, category or whole store)</span>
          </p>
        )}
      </Section>

      <Section title="Options" hint="Optional. Add options when customers must choose, for example a scent or a size. Each option has its own stock and can change the price.">
        {hasVariants && (
          <TextField label="What are customers choosing?" name="opt_ui" value={optionName} onChange={(e) => setOptionName(e.target.value)} placeholder="Scent" maxLength={60}
            help="Shown as the heading above the choices." error={err.optionName} />
        )}
        {variants.length > 0 && (
          <ul className="space-y-3">
            {variants.map((v, i) => (
              <li key={v.uid} className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-3">
                <div className="grid gap-3 sm:grid-cols-12">
                  <TextField className="sm:col-span-4" label="Option name" name={`vl_${i}`} value={v.label} onChange={(e) => updateVariant(v.uid, { label: e.target.value })} maxLength={120} placeholder="Lavender" error={err[`variants.${i}.label`]} />
                  <SelectField className="sm:col-span-3" label="Scent (for filter)" name={`vs_${i}`} value={v.scentId} onChange={(e) => updateVariant(v.uid, { scentId: e.target.value })}>
                    <option value="">None</option>
                    {scents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </SelectField>
                  <TextField className="sm:col-span-2" label="Price +/- JOD" name={`vp_${i}`} inputMode="decimal" value={v.priceDelta} onChange={(e) => updateVariant(v.uid, { priceDelta: e.target.value })} placeholder="0" error={err[`variants.${i}.priceDelta`]} />
                  <TextField className="sm:col-span-2" label="Stock" name={`vk_${i}`} type="number" min={0} value={v.stockQuantity} onChange={(e) => updateVariant(v.uid, { stockQuantity: e.target.value })} disabled={!trackStock} error={err[`variants.${i}.stockQuantity`]} />
                  <div className="flex items-end justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-end">
                    <button type="button" className="btn btn-danger btn-sm !px-2" aria-label={`Remove option ${v.label || i + 1}`} onClick={() => setVariants((vs) => vs.filter((x) => x.uid !== v.uid))}>
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <CheckboxField label="Available" name={`va_${i}`} checked={v.isActive} onChange={(e) => updateVariant(v.uid, { isActive: e.target.checked })} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-soft btn-sm" onClick={() => setVariants((vs) => [...vs, { uid: newUid(), id: null, label: "", scentId: "", priceDelta: "0", stockQuantity: "0", isActive: true }])}>
          <Icon name="plus" className="h-4 w-4" /> Add option
        </button>
        {err.variants && <p className="field-error" role="alert">{err.variants}</p>}
      </Section>

      <Section title="Occasions" hint="Tag the occasions this product suits. Customers can filter gifts by occasion.">
        {occasions.length === 0 ? (
          <p className="text-sm text-ink/65">No occasions yet. <Link href="/admin/occasions" className="font-semibold text-primary underline">Add some</Link>.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {occasions.map((o) => {
              const on = occasionIds.includes(o.id);
              return (
                <button key={o.id} type="button" className="chip" aria-pressed={on}
                  onClick={() => setOccasionIds((ids) => (on ? ids.filter((x) => x !== o.id) : [...ids, o.id]))}>
                  {on && <Icon name="check" className="h-4 w-4" />}
                  {o.name}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Visibility">
        <div className="grid gap-4 sm:grid-cols-3">
          <CheckboxField label="Visible in the shop" name="active_ui" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} help="Untick to hide it without deleting." />
          <CheckboxField label="Featured on the home page" name="feat_ui" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          <CheckboxField label="Available in the gift builder" name="build_ui" checked={inBuilder} onChange={(e) => setInBuilder(e.target.checked)} />
        </div>
      </Section>

      <Section title="Search engines" hint="Optional. Leave empty to use the product name and short description.">
        <TextField label="Web address ending" name="slug_ui" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={160}
          placeholder="lavender-body-scrub" help="Letters, numbers and dashes. Generated from the name when left empty." error={err.slug} autoComplete="off" />
        <TextField label="Page title" name="mt_ui" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={160} error={err.metaTitle} />
        <TextAreaField label="Page description" name="md_ui" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} maxLength={320} error={err.metaDescription} />
      </Section>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-primary/15 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border">
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Saving...">{product ? "Save product" : "Create product"}</SubmitButton>
          <Link href="/admin/products" className="btn btn-ghost">Back to products</Link>
          <div className="min-w-0 flex-1"><FormAlert state={state} /></div>
        </div>
      </div>
    </form>
  );
}
