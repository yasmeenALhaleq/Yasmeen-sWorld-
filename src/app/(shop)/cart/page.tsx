import type { Metadata } from "next";
import { CartView } from "@/components/shop/CartView";
import { PageHero } from "@/components/shop/PageHero";
import { getSettings } from "@/server/services/settings";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("cart.title"), robots: { index: false, follow: false } };

export default async function CartPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHero title={t("cart.title")} />
      <div className="container-page section !pt-8">
        <CartView freeThreshold={settings.freeDeliveryThreshold} />
      </div>
    </>
  );
}
