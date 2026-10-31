"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrderAction } from "@/app/(shop)/checkout/actions";
import { CartLines } from "@/components/shop/CartLines";
import { useCart } from "@/components/shop/CartProvider";
import { CouponBox } from "@/components/shop/CouponBox";
import { QuoteTotals } from "@/components/shop/OrderSummary";
import { useQuote } from "@/components/shop/useQuote";
import { FormAlert, SelectField, TextAreaField, TextField } from "@/components/ui/Fields";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatMoney } from "@/lib/money";
import { sticky, type ActionState } from "@/lib/entity-types";
import { t } from "@/i18n";

const initial: ActionState = {};

export interface CheckoutProps {
  cities: { id: number; name: string; fee: number }[];
  minDate: string;
  maxDate: string;
  payments: { id: string; label: string }[];
  freeThreshold: number;
}

export function CheckoutForm({ cities, minDate, maxDate, payments, freeThreshold }: CheckoutProps) {
  const cart = useCart();
  const [state, action] = useActionState(placeOrderAction, initial);
  const [cityId, setCityId] = useState<string>("");
  const [giftLength, setGiftLength] = useState(0);
  const city = cities.find((c) => String(c.id) === (cityId || state.values?.cityId));
  const { quote, loading, error } = useQuote(cart.lines, cart.coupon, city?.id ?? null, cart.ready);
  const e = state.fieldErrors ?? {};

  if (!cart.ready) return <div className="card card-pad h-96 animate-pulse bg-primary/5" aria-busy="true" aria-label={t("common.loading")} />;

  if (cart.lines.length === 0) {
    return (
      <div className="card card-pad mx-auto max-w-xl py-12 text-center">
        <h2 className="!text-4xl">{t("cart.empty.title")}</h2>
        <p className="mx-auto mt-2 max-w-sm text-ink/75">{t("cart.empty.text")}</p>
        <Link href="/shop" className="btn btn-primary mt-6">{t("cart.empty.shop")}</Link>
      </div>
    );
  }

  const blocked = !quote || !quote.canCheckout;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_26rem] lg:items-start" noValidate>
      {/* What is being ordered: the server prices these ids again when the order is placed. */}
      <input type="hidden" name="cart" value={JSON.stringify(cart.lines)} />
      <input type="hidden" name="couponCode" value={cart.coupon} />
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>

      <div className="space-y-6">
        <section className="card card-pad space-y-4" aria-labelledby="co-contact">
          <h2 id="co-contact" className="!text-2xl">{t("checkout.contact")}</h2>
          <TextField label={t("checkout.name")} name="customerName" required autoComplete="name" maxLength={120} defaultValue={sticky(state, "customerName", "")} error={e.customerName} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t("checkout.phone")} name="phone" type="tel" inputMode="tel" required autoComplete="tel" dir="ltr" placeholder="07X XXX XXXX" defaultValue={sticky(state, "phone", "")} error={e.phone} help={t("checkout.phoneHelp")} />
            <TextField label={t("checkout.email")} name="email" type="email" autoComplete="email" dir="ltr" defaultValue={sticky(state, "email", "")} error={e.email} help={t("checkout.emailHelp")} />
          </div>
        </section>

        <section className="card card-pad space-y-4" aria-labelledby="co-delivery">
          <h2 id="co-delivery" className="!text-2xl">{t("checkout.delivery")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={t("checkout.city")} name="cityId" required value={cityId || sticky(state, "cityId", "")} onChange={(ev) => setCityId(ev.target.value)} error={e.cityId}>
              <option value="">{t("checkout.chooseCity")}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name} — {formatMoney(c.fee)}</option>)}
            </SelectField>
            <TextField label={t("checkout.date")} name="deliveryDate" type="date" required min={minDate} max={maxDate} defaultValue={sticky(state, "deliveryDate", minDate)} error={e.deliveryDate} help={t("checkout.dateHelp")} />
          </div>
          <TextAreaField label={t("checkout.address")} name="address" required rows={3} maxLength={500} autoComplete="street-address" defaultValue={sticky(state, "address", "")} error={e.address} help={t("checkout.addressHelp")} />
          <TextAreaField label={t("checkout.notes")} name="notes" rows={2} maxLength={500} defaultValue={sticky(state, "notes", "")} error={e.notes} />
        </section>

        <section className="card card-pad space-y-4" aria-labelledby="co-gift">
          <h2 id="co-gift" className="!text-2xl">{t("checkout.gift")}</h2>
          <div>
            <TextAreaField label={t("checkout.giftMessage")} name="giftMessage" rows={3} maxLength={300} defaultValue={sticky(state, "giftMessage", "")}
              onChange={(ev) => setGiftLength(ev.target.value.length)} error={e.giftMessage} help={t("checkout.giftHelp")} />
            <p className="help text-end" aria-hidden="true">{giftLength || sticky(state, "giftMessage", "").length} / 300</p>
          </div>
        </section>

        <section className="card card-pad space-y-3" aria-labelledby="co-pay">
          <h2 id="co-pay" className="!text-2xl">{t("checkout.payment")}</h2>
          <fieldset>
            <legend className="sr-only">{t("checkout.payment")}</legend>
            <div className="space-y-2">
              {payments.map((p, i) => (
                <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 has-[:checked]:border-primary">
                  <input type="radio" name="paymentMethod" value={p.id} defaultChecked={sticky(state, "paymentMethod", payments[0].id) === p.id || (i === 0 && !state.values)} className="mt-1 h-5 w-5 accent-[var(--bw-primary)]" />
                  <span>
                    <span className="block font-bold">{p.label}</span>
                    {p.id === "cod" && <span className="block text-sm text-ink/70">{t("checkout.codText")}</span>}
                  </span>
                </label>
              ))}
              <p className="flex items-center gap-2 px-1 text-sm text-ink/60"><Icon name="clock" className="h-4 w-4" /> {t("checkout.onlineSoon")}</p>
            </div>
            {e.paymentMethod && <p className="field-error" role="alert">{e.paymentMethod}</p>}
          </fieldset>
        </section>
      </div>

      <aside className="card card-pad space-y-5 lg:sticky lg:top-28" aria-labelledby="co-summary">
        <h2 id="co-summary" className="!text-2xl">{t("cart.summary")}</h2>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {quote ? (
          <>
            <CartLines lines={quote.lines} editable={false} />
            <CouponBox quote={quote} loading={loading} />
            <QuoteTotals quote={quote} freeThreshold={freeThreshold} />
          </>
        ) : (
          <div className="h-48 animate-pulse rounded-2xl bg-primary/5" aria-label={t("common.loading")} />
        )}
        {quote && !quote.canCheckout && (
          <p className="alert alert-error" role="alert">{t("cart.fixIssues")} <Link href="/cart" className="font-bold underline">{t("checkout.backToCart")}</Link></p>
        )}
        <FormAlert state={state} />
        <SubmitButton className="btn btn-primary btn-lg btn-block" pendingLabel={t("checkout.placing")}>
          {t("checkout.place")}{quote && !blocked ? ` · ${formatMoney(quote.total)}` : ""}
        </SubmitButton>
        <p className="text-center text-xs text-ink/60">{t("checkout.terms")}</p>
        <Link href="/cart" className="block text-center text-sm font-bold text-primary underline underline-offset-4">{t("checkout.backToCart")}</Link>
      </aside>
    </form>
  );
}
