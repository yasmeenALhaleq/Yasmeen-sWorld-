"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useCart } from "@/components/shop/CartProvider";
import { GiftPreview } from "@/components/shop/GiftPreview";
import { ProductImage } from "@/components/shop/ProductImage";
import { Blossom } from "@/components/ui/Botanical";
import { Icon } from "@/components/ui/Icon";
import { formatMoney } from "@/lib/money";
import { giftPrice } from "@/lib/pricing";
import { t, type MessageKey } from "@/i18n";
import type { BuilderData, BuilderProduct, ImageRef } from "@/lib/types";

const STEP_KEYS: MessageKey[] = [
  "builder.step.occasion", "builder.step.base", "builder.step.products", "builder.step.wrap", "builder.step.card", "builder.step.review",
];
const MAX_MESSAGE = 300;

interface Pick { productId: number; variantId: number | null; qty: number }
const pickKey = (p: { productId: number; variantId: number | null }) => `${p.productId}:${p.variantId ?? 0}`;

export function GiftBuilder({ data, initialOccasionId }: { data: BuilderData; initialOccasionId: number | null }) {
  const cart = useCart();
  const top = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(1);
  const [reached, setReached] = useState(1);
  const [occasionId, setOccasionId] = useState<number | null>(initialOccasionId);
  const [occasionChosen, setOccasionChosen] = useState(initialOccasionId !== null);
  const [baseId, setBaseId] = useState<number | null>(data.bases[0]?.id ?? null);
  const [sizeId, setSizeId] = useState<number | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [variantChoice, setVariantChoice] = useState<Record<number, number>>({});
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [wrappingId, setWrappingId] = useState<number | null>(null);
  const [ribbonId, setRibbonId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const base = data.bases.find((b) => b.id === baseId) ?? null;
  const size = base?.sizes.find((s) => s.id === sizeId) ?? null;
  const wrapping = data.wrappings.find((w) => w.id === wrappingId) ?? null;
  const ribbon = data.ribbons.find((r) => r.id === ribbonId) ?? null;
  const capacity = size?.maxItems ?? 0;
  const itemCount = picks.reduce((n, p) => n + p.qty, 0);
  const productById = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const unitPrice = (p: BuilderProduct, variantId: number | null) =>
    (variantId ? p.variants.find((v) => v.id === variantId)?.finalPrice : undefined) ?? p.finalPrice;

  const total = size
    ? giftPrice({
        sizePrice: size.price,
        items: picks.map((p) => ({ unitPrice: unitPrice(productById.get(p.productId)!, p.variantId), qty: p.qty })),
        wrappingPrice: wrapping?.price ?? 0,
        ribbonPrice: ribbon?.price ?? 0,
      })
    : 0;

  // One image per selected unit, in the order they were added, for the preview.
  const previewImages: (ImageRef | null)[] = picks.flatMap((p) =>
    Array.from({ length: p.qty }, () => productById.get(p.productId)?.image ?? null));

  const canContinue: Record<number, boolean> = {
    1: occasionChosen,
    2: Boolean(base && size),
    3: itemCount >= 1 && itemCount <= capacity,
    4: true,
    5: true,
    6: true,
  };

  function go(n: number) {
    setStep(n);
    setReached((r) => Math.max(r, n));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseBase(id: number) {
    setBaseId(id);
    const nextBase = data.bases.find((b) => b.id === id);
    // Keep the size if it exists on the new base, otherwise ask again.
    if (!nextBase?.sizes.some((s) => s.id === sizeId)) setSizeId(null);
  }

  function chooseSize(id: number, maxItems: number) {
    setSizeId(id);
    // Switching to a smaller size: trim the selection from the end.
    setPicks((prev) => {
      let room = maxItems;
      const next: Pick[] = [];
      for (const p of prev) {
        const qty = Math.min(p.qty, room);
        if (qty > 0) next.push({ ...p, qty });
        room -= qty;
      }
      return next;
    });
  }

  function stockFor(p: BuilderProduct, variantId: number | null): number | null {
    return variantId ? p.variants.find((v) => v.id === variantId)?.stock ?? null : p.stock;
  }

  function change(p: BuilderProduct, variantId: number | null, delta: number) {
    setPicks((prev) => {
      const key = pickKey({ productId: p.id, variantId });
      const existing = prev.find((x) => pickKey(x) === key);
      const current = existing?.qty ?? 0;
      const stock = stockFor(p, variantId);
      const used = prev.reduce((n, x) => n + x.qty, 0);
      let qty = current + delta;
      qty = Math.max(0, qty);
      if (stock !== null) qty = Math.min(qty, stock);
      qty = Math.min(qty, current + (capacity - used));
      if (qty === current) return prev;
      if (qty === 0) return prev.filter((x) => pickKey(x) !== key);
      return existing ? prev.map((x) => (pickKey(x) === key ? { ...x, qty } : x)) : [...prev, { productId: p.id, variantId, qty }];
    });
  }

  function addToCart() {
    if (!size) return;
    cart.addGift({
      occasionId,
      sizeId: size.id,
      items: picks.map((p) => ({ productId: p.productId, variantId: p.variantId, qty: p.qty })),
      wrappingId,
      ribbonId,
      cardMessage: message.trim(),
      qty: 1,
    });
    setAdded(true);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startOver() {
    setStep(1); setReached(1); setOccasionId(null); setOccasionChosen(false); setSizeId(null); setPicks([]);
    setWrappingId(null); setRibbonId(null); setMessage(""); setAdded(false);
  }

  // Products for step 3: suggested for the occasion first, then everything else.
  const visibleProducts = useMemo(() => {
    const list = data.products.filter((p) => categoryFilter === "all" || p.categoryId === categoryFilter);
    const suggested = (p: BuilderProduct) => (occasionId !== null && p.occasionIds.includes(occasionId) ? 1 : 0);
    return [...list].sort((a, b) => suggested(b) - suggested(a));
  }, [data.products, categoryFilter, occasionId]);

  if (data.bases.length === 0 || data.products.length === 0) {
    return (
      <div className="card card-pad mx-auto max-w-xl py-12 text-center">
        <Blossom className="mx-auto mb-3 h-12 w-12 text-primary/50" />
        <h2 className="!text-3xl">{t("builder.unavailable.title")}</h2>
        <p className="mt-2 text-ink/75">{t("builder.unavailable.text")}</p>
        <Link href="/gifts" className="btn btn-primary mt-6">{t("builder.unavailable.cta")}</Link>
      </div>
    );
  }

  if (added) {
    return (
      <div className="card card-pad mx-auto max-w-xl py-12 text-center" ref={top}>
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Icon name="check" className="h-8 w-8" /></span>
        <h2 className="!text-4xl">{t("builder.added.title")}</h2>
        <p className="mt-2 text-ink/75">{t("builder.added.text")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/cart" className="btn btn-primary btn-lg">{t("builder.added.cart")}</Link>
          <button type="button" className="btn btn-outline btn-lg" onClick={startOver}>{t("builder.added.another")}</button>
        </div>
      </div>
    );
  }

  const preview = (
    <div className="space-y-3">
      <GiftPreview type={base?.type ?? null} ribbonColor={ribbon?.color ?? null} wrappingColor={wrapping?.color ?? null} capacity={capacity} images={previewImages} className="text-primary" />
      <dl className="space-y-1.5 text-sm">
        {base && <div className="flex justify-between gap-3"><dt className="text-ink/70">{base.name}{size ? ` · ${size.name}` : ""}</dt><dd className="font-bold">{size ? formatMoney(size.price) : "—"}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="text-ink/70">{t("builder.itemsCount")}</dt><dd className="font-bold">{itemCount}{capacity > 0 ? ` / ${capacity}` : ""}</dd></div>
        {wrapping && <div className="flex justify-between gap-3"><dt className="text-ink/70">{wrapping.name}</dt><dd className="font-bold">{wrapping.price > 0 ? formatMoney(wrapping.price) : t("summary.free")}</dd></div>}
        {ribbon && <div className="flex justify-between gap-3"><dt className="text-ink/70">{ribbon.name} {t("builder.ribbon").toLowerCase()}</dt><dd className="font-bold">{ribbon.price > 0 ? formatMoney(ribbon.price) : t("summary.free")}</dd></div>}
        <div className="flex justify-between gap-3 border-t border-primary/15 pt-2 text-lg font-extrabold"><dt>{t("builder.total")}</dt><dd aria-live="polite">{size ? formatMoney(total) : "—"}</dd></div>
      </dl>
    </div>
  );

  return (
    <div ref={top} className="scroll-mt-24">
      {/* ---- step indicator ---- */}
      <nav aria-label={t("builder.steps")} className="mb-6">
        <ol className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
          {STEP_KEYS.map((key, i) => {
            const n = i + 1;
            const done = n < step;
            const enabled = n <= reached;
            return (
              <li key={key} className="flex min-w-0 flex-1 flex-col items-center">
                <button type="button" disabled={!enabled} onClick={() => go(n)} aria-current={n === step ? "step" : undefined}
                  className={`flex w-full min-w-14 flex-col items-center gap-1 rounded-xl px-1 py-1 text-center ${enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-extrabold transition ${
                    n === step ? "border-primary bg-primary text-on-primary" : done ? "border-primary bg-primary/15 text-primary" : "border-ink/25"}`}>
                    {done ? <Icon name="check" className="h-4 w-4" /> : n}
                  </span>
                  <span className={`text-[11px] font-bold leading-tight sm:text-xs ${n === step ? "text-primary" : "text-ink/65"}`}>{t(key)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="card card-pad min-w-0" aria-labelledby="step-title">
          {/* ---- STEP 1: occasion ---- */}
          {step === 1 && (
            <div className="space-y-5">
              <header><h2 id="step-title" className="!text-3xl">{t("builder.s1.title")}</h2><p className="mt-1 text-ink/70">{t("builder.s1.text")}</p></header>
              <div role="radiogroup" aria-labelledby="step-title" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.occasions.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={occasionChosen && occasionId === o.id}
                    onClick={() => { setOccasionId(o.id); setOccasionChosen(true); }}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-primary/25 bg-surface px-4 py-3 text-start font-bold transition hover:border-primary aria-checked:border-primary aria-checked:bg-primary/10">
                    <Blossom className="h-6 w-6 shrink-0 text-primary" /> {o.name}
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={occasionChosen && occasionId === null}
                  onClick={() => { setOccasionId(null); setOccasionChosen(true); }}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-surface px-4 py-3 text-start font-bold transition hover:border-primary aria-checked:border-solid aria-checked:border-primary aria-checked:bg-primary/10">
                  <Icon name="heart" className="h-6 w-6 shrink-0 text-primary" /> {t("builder.s1.none")}
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 2: base + size ---- */}
          {step === 2 && (
            <div className="space-y-6">
              <header><h2 id="step-title" className="!text-3xl">{t("builder.s2.title")}</h2><p className="mt-1 text-ink/70">{t("builder.s2.text")}</p></header>
              <div role="radiogroup" aria-label={t("builder.s2.title")} className="grid gap-3 sm:grid-cols-2">
                {data.bases.map((b) => (
                  <button key={b.id} type="button" role="radio" aria-checked={baseId === b.id} onClick={() => chooseBase(b.id)}
                    className="flex items-center gap-3 rounded-2xl border-2 border-primary/25 bg-surface p-3 text-start transition hover:border-primary aria-checked:border-primary aria-checked:bg-primary/10">
                    <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-primary/5">
                      {b.image ? <ProductImage image={b.image} alt="" sizes="80px" className="h-full w-full" /> : <GiftPreview type={b.type} ribbonColor={null} wrappingColor={null} capacity={0} images={[]} className="h-full text-primary" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-xl font-semibold leading-tight">{b.name}</span>
                      {b.description && <span className="block text-sm text-ink/70">{b.description}</span>}
                      <span className="mt-0.5 block text-sm font-bold text-primary">{t("price.from")} {formatMoney(Math.min(...b.sizes.map((s) => s.price)))}</span>
                    </span>
                  </button>
                ))}
              </div>

              {base && (
                <div>
                  <h3 className="mb-2 !text-2xl">{t("builder.s2.size")}</h3>
                  <div role="radiogroup" aria-label={t("builder.s2.size")} className="grid gap-3 sm:grid-cols-3">
                    {base.sizes.map((s) => (
                      <button key={s.id} type="button" role="radio" aria-checked={sizeId === s.id} onClick={() => chooseSize(s.id, s.maxItems)}
                        className="rounded-2xl border-2 border-primary/25 bg-surface p-4 text-start transition hover:border-primary aria-checked:border-primary aria-checked:bg-primary/10">
                        <span className="block font-serif text-2xl font-semibold">{s.name}</span>
                        <span className="block text-lg font-extrabold text-primary">{formatMoney(s.price)}</span>
                        <span className="block text-sm text-ink/70">{t("builder.s2.fits", { count: s.maxItems })}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- STEP 3: products ---- */}
          {step === 3 && size && (
            <div className="space-y-5">
              <header>
                <h2 id="step-title" className="!text-3xl">{t("builder.s3.title")}</h2>
                <p className="mt-1 text-ink/70">{t("builder.s3.text", { count: capacity })}</p>
              </header>
              <div className="sticky top-16 z-10 -mx-1 rounded-2xl bg-surface/95 px-1 py-2 backdrop-blur sm:top-20">
                <div className="mb-1 flex justify-between text-sm font-bold" aria-live="polite">
                  <span>{t("builder.s3.chosen", { count: itemCount, max: capacity })}</span>
                  <span>{formatMoney(total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary/15" role="progressbar" aria-valuenow={itemCount} aria-valuemin={0} aria-valuemax={capacity} aria-label={t("builder.itemsCount")}>
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${capacity ? (itemCount / capacity) * 100 : 0}%` }} />
                </div>
              </div>

              {data.categories.length > 1 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("filters.category")}>
                  <button type="button" className="chip" aria-pressed={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>{t("filters.all")}</button>
                  {data.categories.map((c) => (
                    <button key={c.id} type="button" className="chip" aria-pressed={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>{c.name}</button>
                  ))}
                </div>
              )}

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {visibleProducts.map((p) => {
                  const chosenVariant = p.variants.length ? variantChoice[p.id] ?? p.variants.find((v) => v.inStock)?.id ?? p.variants[0].id : null;
                  const pick = picks.find((x) => pickKey(x) === pickKey({ productId: p.id, variantId: chosenVariant }));
                  const totalOfProduct = picks.filter((x) => x.productId === p.id).reduce((n, x) => n + x.qty, 0);
                  const stock = stockFor(p, chosenVariant);
                  const soldOut = !p.inStock || (stock !== null && stock <= 0);
                  const qty = pick?.qty ?? 0;
                  const full = itemCount >= capacity;
                  const suggested = occasionId !== null && p.occasionIds.includes(occasionId);
                  const price = unitPrice(p, chosenVariant);
                  return (
                    <li key={p.id} className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-surface ${totalOfProduct > 0 ? "border-primary" : "border-primary/15"}`}>
                      <div className="relative">
                        <ProductImage image={p.image} alt={p.name} sizes="(min-width: 640px) 200px, 45vw" className="aspect-square w-full" />
                        {suggested && <span className="badge absolute start-2 top-2 bg-accent text-white">{t("builder.suggested")}</span>}
                        {totalOfProduct > 0 && <span className="absolute end-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-1.5 text-sm font-extrabold text-on-primary">{totalOfProduct}</span>}
                        {soldOut && <span className="absolute inset-0 flex items-center justify-center bg-surface/70 text-xs font-extrabold uppercase tracking-widest">{t("product.soldOut")}</span>}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <p className="text-sm font-bold leading-tight">{p.name}</p>
                        {p.variants.length > 0 && (
                          <select aria-label={p.optionName} className="input !min-h-9 !py-1 !text-sm" value={chosenVariant ?? ""}
                            onChange={(e) => setVariantChoice((c) => ({ ...c, [p.id]: Number(e.target.value) }))}>
                            {p.variants.map((v) => <option key={v.id} value={v.id} disabled={!v.inStock}>{v.label}{v.inStock ? "" : ` (${t("product.soldOut")})`}</option>)}
                          </select>
                        )}
                        <p className="mt-auto text-sm font-extrabold text-primary">{formatMoney(price)}</p>
                        {qty === 0 ? (
                          <button type="button" className="btn btn-sm btn-outline w-full" disabled={soldOut || full} onClick={() => change(p, chosenVariant, 1)}>
                            <Icon name="plus" className="h-4 w-4" /> {full && !soldOut ? t("builder.s3.full") : t("builder.s3.add")}
                          </button>
                        ) : (
                          <div className="flex items-center justify-between rounded-full border-2 border-primary/30">
                            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary/10" onClick={() => change(p, chosenVariant, -1)} aria-label={t("builder.s3.removeOne", { name: p.name })}><Icon name="minus" className="h-4 w-4" /></button>
                            <span className="font-extrabold" aria-live="polite">{qty}</span>
                            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" disabled={full || (stock !== null && qty >= stock)} onClick={() => change(p, chosenVariant, 1)} aria-label={t("builder.s3.addOne", { name: p.name })}><Icon name="plus" className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ---- STEP 4: wrapping + ribbon ---- */}
          {step === 4 && (
            <div className="space-y-6">
              <header><h2 id="step-title" className="!text-3xl">{t("builder.s4.title")}</h2><p className="mt-1 text-ink/70">{t("builder.s4.text")}</p></header>

              <div>
                <h3 className="mb-2 !text-2xl">{t("builder.wrapping")}</h3>
                <div role="radiogroup" aria-label={t("builder.wrapping")} className="grid gap-3 sm:grid-cols-2">
                  <button type="button" role="radio" aria-checked={wrappingId === null} onClick={() => setWrappingId(null)}
                    className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 p-3 text-start font-bold aria-checked:border-solid aria-checked:border-primary aria-checked:bg-primary/10">
                    <span className="h-10 w-10 rounded-full border-2 border-dashed border-ink/30" /> {t("builder.s4.none")}
                  </button>
                  {data.wrappings.map((w) => (
                    <button key={w.id} type="button" role="radio" aria-checked={wrappingId === w.id} onClick={() => setWrappingId(w.id)}
                      className="flex items-center gap-3 rounded-2xl border-2 border-primary/25 bg-surface p-3 text-start transition hover:border-primary aria-checked:border-primary aria-checked:bg-primary/10">
                      <span className="h-10 w-10 shrink-0 rounded-full border border-ink/15" style={{ background: w.color ?? "#E8D9C5" }} />
                      <span><span className="block font-bold">{w.name}</span><span className="block text-sm text-ink/70">{w.price > 0 ? `+ ${formatMoney(w.price)}` : t("summary.free")}</span></span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 !text-2xl">{t("builder.ribbon")}</h3>
                <div role="radiogroup" aria-label={t("builder.ribbon")} className="flex flex-wrap gap-3">
                  <button type="button" role="radio" aria-checked={ribbonId === null} onClick={() => setRibbonId(null)}
                    className="flex min-h-14 items-center gap-2 rounded-full border-2 border-dashed border-primary/30 px-4 font-bold aria-checked:border-solid aria-checked:border-primary aria-checked:bg-primary/10">
                    {t("builder.s4.none")}
                  </button>
                  {data.ribbons.map((r) => (
                    <button key={r.id} type="button" role="radio" aria-checked={ribbonId === r.id} onClick={() => setRibbonId(r.id)} title={r.name}
                      className="flex min-h-14 items-center gap-2 rounded-full border-2 border-primary/25 bg-surface py-2 ps-2 pe-4 font-bold transition hover:border-primary aria-checked:border-primary aria-checked:bg-primary/10">
                      <span className="h-9 w-9 rounded-full border border-ink/20" style={{ background: r.color ?? "#E8B4C8" }} />
                      <span className="text-start"><span className="block text-sm leading-tight">{r.name}</span>{r.price > 0 && <span className="block text-xs font-normal text-ink/65">+ {formatMoney(r.price)}</span>}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---- STEP 5: card message ---- */}
          {step === 5 && (
            <div className="space-y-5">
              <header><h2 id="step-title" className="!text-3xl">{t("builder.s5.title")}</h2><p className="mt-1 text-ink/70">{t("builder.s5.text")}</p></header>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="card-message" className="label">{t("builder.s5.label")}</label>
                  <textarea id="card-message" className="input" rows={6} maxLength={MAX_MESSAGE} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("builder.s5.placeholder")} />
                  <p className="help text-end">{message.length} / {MAX_MESSAGE}</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative w-full max-w-xs rotate-1 rounded-lg border border-secondary bg-gradient-to-br from-surface to-secondary/20 p-6 text-center shadow-soft" aria-hidden="true">
                    <Blossom className="mx-auto mb-3 h-7 w-7 text-primary/60" />
                    <p className="min-h-24 whitespace-pre-line font-serif text-xl italic leading-snug">{message || t("builder.s5.placeholder")}</p>
                    <span className="absolute -top-2 start-1/2 h-4 w-14 -translate-x-1/2 rotate-[-3deg] rounded-sm bg-secondary/60 rtl:translate-x-1/2" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- STEP 6: review ---- */}
          {step === 6 && size && base && (
            <div className="space-y-5">
              <header><h2 id="step-title" className="!text-3xl">{t("builder.s6.title")}</h2><p className="mt-1 text-ink/70">{t("builder.s6.text")}</p></header>
              <dl className="divide-y divide-primary/10 text-sm">
                {[
                  { label: t("builder.occasion"), value: data.occasions.find((o) => o.id === occasionId)?.name ?? t("builder.s1.none"), step: 1 },
                  { label: t("builder.step.base"), value: `${base.name} · ${size.name}`, price: formatMoney(size.price), step: 2 },
                  { label: t("builder.wrapping"), value: wrapping?.name ?? t("builder.s4.none"), price: wrapping && wrapping.price > 0 ? formatMoney(wrapping.price) : undefined, step: 4 },
                  { label: t("builder.ribbon"), value: ribbon?.name ?? t("builder.s4.none"), price: ribbon && ribbon.price > 0 ? formatMoney(ribbon.price) : undefined, step: 4 },
                  { label: t("builder.step.card"), value: message.trim() ? `“${message.trim()}”` : t("builder.s6.noMessage"), step: 5 },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0"><dt className="text-xs font-bold uppercase tracking-wider text-ink/55">{row.label}</dt><dd className="font-semibold">{row.value}</dd></div>
                    <div className="flex shrink-0 items-center gap-3"><span className="font-bold">{row.price}</span><button type="button" className="text-primary underline underline-offset-2" onClick={() => go(row.step)}>{t("builder.s6.edit")}</button></div>
                  </div>
                ))}
                <div className="py-3">
                  <div className="flex items-center justify-between"><dt className="text-xs font-bold uppercase tracking-wider text-ink/55">{t("builder.s6.products")} ({itemCount})</dt><button type="button" className="text-primary underline underline-offset-2" onClick={() => go(3)}>{t("builder.s6.edit")}</button></div>
                  <dd>
                    <ul className="mt-1 space-y-1">
                      {picks.map((p) => {
                        const prod = productById.get(p.productId)!;
                        const v = prod.variants.find((x) => x.id === p.variantId);
                        return (
                          <li key={pickKey(p)} className="flex justify-between gap-3">
                            <span>{p.qty} × {prod.name}{v ? ` (${v.label})` : ""}</span>
                            <span className="font-bold">{formatMoney(unitPrice(prod, p.variantId) * p.qty)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </dd>
                </div>
              </dl>
              <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-5 py-4 text-xl font-extrabold"><span>{t("builder.total")}</span><span>{formatMoney(total)}</span></div>
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={addToCart}><Icon name="bag" /> {t("builder.s6.add")}</button>
            </div>
          )}

          {/* ---- navigation ---- */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-primary/10 pt-5">
            {step > 1 ? (
              <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}><Icon name="chevron-left" className="h-4 w-4 rtl:rotate-180" /> {t("common.back")}</button>
            ) : <span />}
            {step < 6 && (
              <button type="button" className="btn btn-primary btn-lg" disabled={!canContinue[step]} onClick={() => go(step + 1)}>
                {step === 5 && !message.trim() ? t("builder.s5.skip") : t("common.next")} <Icon name="chevron-right" className="h-4 w-4 rtl:rotate-180" />
              </button>
            )}
          </div>
          {step === 3 && !canContinue[3] && <p className="mt-2 text-end text-sm text-ink/65">{t("builder.s3.needOne")}</p>}
        </section>

        {/* ---- live preview ---- */}
        <aside className="lg:sticky lg:top-28" aria-label={t("builder.preview")}>
          <div className="card card-pad hidden lg:block">
            <h2 className="mb-2 !text-2xl">{t("builder.preview")}</h2>
            {preview}
          </div>
          <div className="lg:hidden">
            <button type="button" className="btn btn-soft btn-block justify-between" aria-expanded={showPreview} onClick={() => setShowPreview((s) => !s)}>
              <span>{t("builder.preview")}: {itemCount}{capacity ? ` / ${capacity}` : ""} · {size ? formatMoney(total) : "—"}</span>
              <Icon name={showPreview ? "chevron-up" : "chevron-down"} className="h-4 w-4" />
            </button>
            {showPreview && <div className="card card-pad mt-3">{preview}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
