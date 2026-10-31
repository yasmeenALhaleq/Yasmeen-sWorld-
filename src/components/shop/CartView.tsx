"use client";

import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { CartLines } from "@/components/shop/CartLines";
import { CouponBox } from "@/components/shop/CouponBox";
import { QuoteTotals } from "@/components/shop/OrderSummary";
import { useQuote } from "@/components/shop/useQuote";
import { Blossom } from "@/components/ui/Botanical";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";

export function CartView({ freeThreshold }: { freeThreshold: number }) {
  const cart = useCart();
  const { quote, loading, error } = useQuote(cart.lines, cart.coupon, null, cart.ready);

  if (!cart.ready) {
    return <div className="card card-pad h-64 animate-pulse bg-primary/5" aria-busy="true" aria-label={t("common.loading")} />;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="card card-pad mx-auto max-w-xl py-14 text-center">
        <Blossom className="mx-auto mb-4 h-14 w-14 text-primary/50" />
        <h2 className="!text-4xl">{t("cart.empty.title")}</h2>
        <p className="mx-auto mt-2 max-w-sm text-ink/75">{t("cart.empty.text")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="btn btn-primary">{t("cart.empty.shop")}</Link>
          <Link href="/gifts/build" className="btn btn-outline">{t("nav.buildGift")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
      <section className="card card-pad" aria-labelledby="cart-items" aria-busy={loading}>
        <div className="flex items-center justify-between">
          <h2 id="cart-items" className="!text-2xl">{t("cart.items", { count: cart.count })}</h2>
          <button type="button" className="text-sm font-semibold text-ink/70 underline underline-offset-2 hover:text-red-800" onClick={cart.clear}>{t("cart.clear")}</button>
        </div>
        {error && <p className="alert alert-error mt-3" role="alert">{error}</p>}
        {quote ? <CartLines lines={quote.lines} /> : <div className="mt-4 h-40 animate-pulse rounded-2xl bg-primary/5" aria-label={t("common.loading")} />}
      </section>

      <aside className="card card-pad space-y-5 lg:sticky lg:top-28" aria-labelledby="cart-summary">
        <h2 id="cart-summary" className="!text-2xl">{t("cart.summary")}</h2>
        {quote ? (
          <>
            <CouponBox quote={quote} loading={loading} />
            <QuoteTotals quote={quote} freeThreshold={freeThreshold} estimate />
            {!quote.canCheckout && <p className="alert alert-error" role="alert">{t("cart.fixIssues")}</p>}
            {quote.canCheckout ? (
              <Link href="/checkout" className="btn btn-primary btn-lg btn-block">{t("cart.checkout")}</Link>
            ) : (
              <button type="button" className="btn btn-primary btn-lg btn-block" disabled>{t("cart.checkout")}</button>
            )}
          </>
        ) : (
          <div className="h-40 animate-pulse rounded-2xl bg-primary/5" aria-label={t("common.loading")} />
        )}
        <p className="flex items-start gap-2 text-xs text-ink/65"><Icon name="truck" className="mt-0.5 h-4 w-4 shrink-0" /> {t("cart.deliveryNote")}</p>
        <Link href="/shop" className="block text-center text-sm font-bold text-primary underline underline-offset-4">{t("cart.continue")}</Link>
      </aside>
    </div>
  );
}
