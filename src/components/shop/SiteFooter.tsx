import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Sprig } from "@/components/ui/Botanical";
import { getSettings } from "@/server/services/settings";
import { getTaxonomy } from "@/server/services/catalog";
import { logoUrl } from "@/lib/images";
import { t } from "@/i18n";

export async function SiteFooter() {
  const [settings, taxonomy] = await Promise.all([getSettings(), getTaxonomy()]);
  const whatsapp = settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}` : "";

  return (
    <footer className="relative mt-8 overflow-hidden bg-ink text-page">
      <Sprig className="pointer-events-none absolute -bottom-6 end-4 h-60 w-32 text-secondary opacity-10" />
      <div className="container-page relative grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          {settings.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl(settings.logoKey)} alt={settings.storeName} className="h-12 w-auto rounded-lg bg-surface/95 p-1.5" />
          ) : (
            <p className="font-serif text-3xl font-bold text-secondary">{settings.storeName}</p>
          )}
          {settings.aboutText && <p className="max-w-xs text-sm leading-relaxed opacity-80">{settings.aboutText}</p>}
          {settings.instagramUrl && (
            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold hover:text-secondary">
              <Icon name="instagram" className="h-5 w-5" /> {t("footer.followInstagram")}
            </a>
          )}
        </div>

        <nav aria-label={t("footer.shop")}>
          <h2 className="mb-3 !font-sans !text-xs font-extrabold uppercase tracking-[0.2em] text-secondary">{t("footer.shop")}</h2>
          <ul className="space-y-2 text-sm">
            {taxonomy.categories.map((c) => (
              <li key={c.id}><Link href={`/category/${c.slug}`} className="opacity-85 hover:text-secondary hover:opacity-100">{c.name}</Link></li>
            ))}
            <li><Link href="/gifts" className="opacity-85 hover:text-secondary hover:opacity-100">{t("nav.gifts")}</Link></li>
            <li><Link href="/gifts/build" className="opacity-85 hover:text-secondary hover:opacity-100">{t("nav.buildGift")}</Link></li>
          </ul>
        </nav>

        <nav aria-label={t("footer.occasions")}>
          <h2 className="mb-3 !font-sans !text-xs font-extrabold uppercase tracking-[0.2em] text-secondary">{t("footer.occasions")}</h2>
          <ul className="space-y-2 text-sm">
            {taxonomy.occasions.slice(0, 7).map((o) => (
              <li key={o.id}><Link href={`/gifts?occasion=${o.slug}`} className="opacity-85 hover:text-secondary hover:opacity-100">{o.name}</Link></li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 !font-sans !text-xs font-extrabold uppercase tracking-[0.2em] text-secondary">{t("footer.contact")}</h2>
          <ul className="space-y-3 text-sm">
            {settings.contactPhone && (
              <li><a href={`tel:${settings.contactPhone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-secondary"><Icon name="phone" className="h-4 w-4" /><span dir="ltr">{settings.contactPhone}</span></a></li>
            )}
            {whatsapp && (
              <li><a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-secondary"><Icon name="whatsapp" className="h-4 w-4" />{t("footer.whatsapp")}</a></li>
            )}
            {settings.contactEmail && (
              <li><a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2 break-all hover:text-secondary"><Icon name="mail" className="h-4 w-4 shrink-0" />{settings.contactEmail}</a></li>
            )}
            <li className="flex items-center gap-2 opacity-85"><Icon name="truck" className="h-4 w-4" />{t("footer.delivery")}</li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-page/15">
        <p className="container-page py-4 text-center text-xs opacity-70">
          © {new Date().getFullYear()} {settings.storeName}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
