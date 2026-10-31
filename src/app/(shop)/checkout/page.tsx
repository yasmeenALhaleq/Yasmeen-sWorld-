import type { Metadata } from "next";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { PageHero } from "@/components/shop/PageHero";
import { query } from "@/server/db/pool";
import { env } from "@/server/env";
import { availablePaymentProviders } from "@/server/payments";
import { getSettings } from "@/server/services/settings";
import { addDays, todayIn } from "@/lib/time";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("checkout.title"), robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const [settings, cities] = await Promise.all([
    getSettings(),
    query<{ id: number; name: string; fee: number }>("SELECT id, name, fee FROM cities WHERE is_active = 1 ORDER BY sort_order, name"),
  ]);
  const today = todayIn(env.timeZone);
  const payments = availablePaymentProviders(settings).map((p) => ({ id: p.id, label: t(p.labelKey) }));

  return (
    <>
      <PageHero title={t("checkout.title")} />
      <div className="container-page section !pt-8">
        {cities.length === 0 || payments.length === 0 ? (
          <p className="alert alert-error mx-auto max-w-xl">{t("checkout.unavailable")}</p>
        ) : (
          <CheckoutForm
            cities={cities.map((c) => ({ id: c.id, name: c.name, fee: Number(c.fee) }))}
            minDate={addDays(today, settings.deliveryLeadDays)}
            maxDate={addDays(today, settings.deliveryMaxDays)}
            payments={payments}
            freeThreshold={settings.freeDeliveryThreshold}
          />
        )}
      </div>
    </>
  );
}
