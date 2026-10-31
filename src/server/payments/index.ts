import "server-only";
import type { MessageKey } from "@/i18n";
import type { Settings } from "@/server/services/settings";

// Payment providers. Checkout only talks to this registry, so adding online
// payment later (for example a Jordanian card gateway) means:
//   1. implement PaymentProvider below (create the payment session in
//      `initiate`, return the gateway's redirectUrl),
//   2. add a webhook route that confirms the payment and updates the
//      `payments` and `orders.payment_status` rows,
//   3. register it here and switch "online_payments_enabled" on in settings.
// Cash on delivery needs no gateway: the order starts "unpaid" and the admin
// marks it "paid" when the cash is collected.

export interface PaymentOrder {
  id: number;
  orderNumber: string;
  total: number;
  currency: "JOD";
  customerName: string;
  email: string | null;
}

export interface PaymentInitResult {
  /** Send the customer here to pay (hosted gateway page). */
  redirectUrl?: string;
}

export interface PaymentProvider {
  id: string;
  labelKey: MessageKey;
  descriptionKey?: MessageKey;
  isEnabled(settings: Settings): boolean;
  initiate?(order: PaymentOrder): Promise<PaymentInitResult>;
}

const cashOnDelivery: PaymentProvider = {
  id: "cod",
  labelKey: "payment.cod",
  isEnabled: (settings) => settings.codEnabled,
};

const providers: PaymentProvider[] = [cashOnDelivery];

export function availablePaymentProviders(settings: Settings): PaymentProvider[] {
  return providers.filter((p) => p.isEnabled(settings));
}

export function getPaymentProvider(id: string, settings: Settings): PaymentProvider | null {
  return availablePaymentProviders(settings).find((p) => p.id === id) ?? null;
}
