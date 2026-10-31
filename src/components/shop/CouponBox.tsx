"use client";

import { useState } from "react";
import { useCart } from "@/components/shop/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";
import type { CartQuote } from "@/lib/types";

/**
 * Enter / remove a coupon code. The result (valid or not) comes from the
 * server quote. Deliberately not a <form>: it is also used inside the checkout
 * form, and forms cannot be nested.
 */
export function CouponBox({ quote, loading }: { quote: CartQuote | null; loading: boolean }) {
  const { coupon, setCoupon } = useCart();
  const [draft, setDraft] = useState("");
  const applied = quote?.coupon;

  const apply = () => {
    if (draft.trim()) setCoupon(draft.trim());
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span className="flex items-center gap-2 font-bold"><Icon name="check-circle" className="h-5 w-5" /> {t("coupon.applied", { code: applied.code })}</span>
        <button type="button" className="font-semibold underline underline-offset-2" onClick={() => { setCoupon(""); setDraft(""); }}>{t("common.remove")}</button>
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby="coupon-label" className="space-y-2">
      <label id="coupon-label" htmlFor="coupon" className="label">{t("coupon.label")}</label>
      <div className="flex gap-2">
        <input
          id="coupon"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
          className="input uppercase"
          maxLength={40}
          autoComplete="off"
          placeholder={t("coupon.placeholder")}
        />
        <button type="button" className="btn btn-soft shrink-0" onClick={apply} disabled={loading || !draft.trim()}>{t("coupon.apply")}</button>
      </div>
      {coupon && quote?.couponError && <p className="field-error" role="alert">{quote.couponError}</p>}
    </div>
  );
}
