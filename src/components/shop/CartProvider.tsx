"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cartSchema } from "@/lib/cart-schema";
import { t } from "@/i18n";
import type { CartLineInput } from "@/lib/types";

// The cart lives in the browser (localStorage) so it works without an account
// and survives reloads. It only stores WHAT is in the cart; prices are always
// calculated by the server.

const CART_KEY = "bw_cart_v1";
const COUPON_KEY = "bw_coupon_v1";

type GiftConfig = Omit<Extract<CartLineInput, { kind: "gift" }>, "id" | "kind">;

interface CartContextValue {
  lines: CartLineInput[];
  count: number;
  /** False until the saved cart has been read from the browser. */
  ready: boolean;
  coupon: string;
  setCoupon: (code: string) => void;
  addProduct: (productId: number, variantId: number | null, qty?: number) => void;
  addGift: (config: GiftConfig) => void;
  setQty: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `l${Date.now()}${Math.random().toString(36).slice(2)}`);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback; // storage blocked or corrupted
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: the cart still works for this visit */
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLineInput[]>([]);
  const [coupon, setCouponState] = useState("");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Load the saved cart once, and follow changes made in other tabs.
  useEffect(() => {
    const load = () => {
      const parsed = cartSchema.safeParse(readStorage<unknown>(CART_KEY, []));
      setLines(parsed.success ? (parsed.data as CartLineInput[]) : []);
      setCouponState(readStorage<string>(COUPON_KEY, ""));
    };
    load();
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === CART_KEY || e.key === COUPON_KEY) load(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => { if (ready) writeStorage(CART_KEY, lines); }, [lines, ready]);
  useEffect(() => { if (ready) writeStorage(COUPON_KEY, coupon); }, [coupon, ready]);

  const showToast = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const addProduct = useCallback((productId: number, variantId: number | null, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.kind === "product" && l.productId === productId && l.variantId === variantId);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + qty, 99) } : l));
      return [...prev, { id: newId(), kind: "product", productId, variantId, qty: Math.min(qty, 99) }];
    });
    showToast(t("cart.toast.added"));
  }, [showToast]);

  const addGift = useCallback((config: GiftConfig) => {
    setLines((prev) => [...prev, { ...config, id: newId(), kind: "gift" }]);
    showToast(t("cart.toast.giftAdded"));
  }, [showToast]);

  const setQty = useCallback((lineId: string, qty: number) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, qty: Math.min(Math.max(qty, 1), l.kind === "gift" ? 20 : 99) } : l)));
  }, []);
  const remove = useCallback((lineId: string) => setLines((prev) => prev.filter((l) => l.id !== lineId)), []);
  const clear = useCallback(() => { setLines([]); setCouponState(""); }, []);
  const setCoupon = useCallback((code: string) => setCouponState(code.toUpperCase().slice(0, 40)), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines, ready, coupon, setCoupon, addProduct, addGift, setQty, remove, clear,
      count: lines.reduce((n, l) => n + l.qty, 0),
    }),
    [lines, ready, coupon, setCoupon, addProduct, addGift, setQty, remove, clear],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 sm:bottom-6">
        {toast && (
          <div key={toast.id} className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-page shadow-xl">
            <Icon name="check-circle" className="h-5 w-5 shrink-0 text-secondary" />
            <span>{toast.message}</span>
            <Link href="/cart" className="font-extrabold underline underline-offset-2" onClick={() => setToast(null)}>{t("cart.toast.view")}</Link>
          </div>
        )}
      </div>
    </CartContext.Provider>
  );
}
