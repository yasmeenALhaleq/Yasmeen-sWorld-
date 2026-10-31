"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import type { CartLineInput, CartQuote } from "@/lib/types";

/**
 * Asks the server to price the cart (debounced). Keeps the previous answer on
 * screen while a new one loads, so totals do not flicker.
 */
export function useQuote(lines: CartLineInput[], couponCode: string, cityId: number | null, enabled: boolean) {
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const serial = useRef(0);

  // A stable key so effects re-run only when something that affects the price changes.
  const key = JSON.stringify([lines, couponCode, cityId]);

  useEffect(() => {
    if (!enabled) return;
    if (lines.length === 0) { setQuote(null); setLoading(false); return; }

    const mine = ++serial.current;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines, couponCode: couponCode || null, cityId }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as CartQuote;
        if (mine === serial.current) { setQuote(data); setError(""); }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (mine === serial.current) setError(t("cart.error.load"));
      } finally {
        if (mine === serial.current) setLoading(false);
      }
    }, 250);

    return () => { window.clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { quote, loading, error };
}
