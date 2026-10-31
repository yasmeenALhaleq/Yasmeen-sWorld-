"use client";

import { useActionState } from "react";
import { updateOrderStatusAction, updatePaymentStatusAction } from "@/app/admin/_actions/orders";
import { FormAlert, SelectField, TextField } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/types";
import { t, type MessageKey } from "@/i18n";
import type { ActionState } from "@/lib/entity-types";

const initial: ActionState = {};

export function OrderStatusForm({ orderId, status }: { orderId: number; status: OrderStatus }) {
  const [state, action] = useActionState(updateOrderStatusAction.bind(null, orderId), initial);
  const cancelled = status === "cancelled";
  return (
    <form action={action} className="space-y-3">
      <FormAlert state={state} />
      <SelectField label="Order status" name="status" defaultValue={status} disabled={cancelled} help={cancelled ? "Cancelled orders cannot be reopened." : "Cancelling puts the stock back automatically."}>
        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}` as MessageKey)}</option>)}
      </SelectField>
      {!cancelled && (
        <>
          <TextField label="Note (optional)" name="note" maxLength={300} placeholder="e.g. Driver called the customer" />
          <SubmitButton pendingLabel="Updating..." className="btn btn-primary btn-sm">Update status</SubmitButton>
        </>
      )}
    </form>
  );
}

export function PaymentStatusForm({ orderId, status }: { orderId: number; status: PaymentStatus }) {
  const [state, action] = useActionState(updatePaymentStatusAction.bind(null, orderId), initial);
  return (
    <form action={action} className="space-y-3">
      <FormAlert state={state} />
      <SelectField label="Payment" name="paymentStatus" defaultValue={status}>
        {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{t(`payment.${s}` as MessageKey)}</option>)}
      </SelectField>
      <SubmitButton pendingLabel="Saving..." className="btn btn-soft btn-sm">Save payment</SubmitButton>
    </form>
  );
}
