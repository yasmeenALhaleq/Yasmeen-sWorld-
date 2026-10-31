import { CartProvider } from "@/components/shop/CartProvider";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { SiteFooter } from "@/components/shop/SiteFooter";
import { WhatsAppFab } from "@/components/shop/WhatsAppFab";
import { getSettings } from "@/server/services/settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const whatsapp = settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}` : "";

  return (
    <CartProvider>
      <SiteHeader />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <SiteFooter />
      {whatsapp && <WhatsAppFab href={whatsapp} />}
    </CartProvider>
  );
}
