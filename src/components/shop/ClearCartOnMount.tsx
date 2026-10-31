"use client";

import { useEffect } from "react";
import { useCart } from "@/components/shop/CartProvider";

/** Empties the cart once an order has been placed (rendered on the confirmation page). */
export function ClearCartOnMount() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);
  return null;
}
