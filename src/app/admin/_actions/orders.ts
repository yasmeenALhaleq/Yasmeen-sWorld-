"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import { updateOrderStatus, updatePaymentStatus } from "@/server/services/orders";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/types";
import type { ActionState } from "@/lib/entity-types";

export async function updateOrderStatusAction(orderId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const status = String(form.get("status") ?? "") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return { error: "Choose a status." };

  const result = await updateOrderStatus(orderId, status, admin.adminId, String(form.get("note") ?? "").trim());
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Status updated." };
}

export async function updatePaymentStatusAction(orderId: number, _prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const status = String(form.get("paymentStatus") ?? "") as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(status)) return { error: "Choose a payment status." };

  const result = await updatePaymentStatus(orderId, status, admin.adminId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Payment status updated." };
}
