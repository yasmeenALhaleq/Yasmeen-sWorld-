import Link from "next/link";
import { CartButton, MobileMenu, SearchToggle, type MenuLink } from "@/components/shop/HeaderControls";
import { Icon } from "@/components/ui/Icon";
import { getSettings } from "@/server/services/settings";
import { getTaxonomy } from "@/server/services/catalog";
import { logoUrl } from "@/lib/images";
import { t } from "@/i18n";

export async function SiteHeader() {
  const [settings, taxonomy] = await Promise.all([getSettings(), getTaxonomy()]);

  const links: MenuLink[] = [
    { label: t("nav.shop"), href: "/shop", children: taxonomy.categories.map((c) => ({ label: c.name, href: `/category/${c.slug}` })) },
    { label: t("nav.gifts"), href: "/gifts", children: taxonomy.occasions.map((o) => ({ label: o.name, href: `/gifts?occasion=${o.slug}` })) },
    { label: t("nav.buildGift"), href: "/gifts/build" },
  ];

  return (
    <>
      <a href="#main" className="sr-only-focusable fixed start-3 top-3 z-[60] rounded-full bg-button px-4 py-2 font-bold text-on-button">{t("nav.skip")}</a>
      {settings.announcement && (
        <div className="bg-primary px-4 py-2 text-center text-xs font-bold tracking-wide text-on-primary sm:text-sm">{settings.announcement}</div>
      )}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-surface/90 backdrop-blur-md">
        <div className="container-page relative flex h-16 items-center gap-2 sm:h-20 sm:gap-4">
          <MobileMenu links={links} storeName={settings.storeName} />

          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${settings.storeName} - ${t("nav.home")}`}>
            {settings.logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl(settings.logoKey)} alt={settings.storeName} className="h-9 w-auto max-w-40 object-contain sm:h-12" />
            ) : (
              <span className="font-serif text-2xl font-bold tracking-tight text-primary sm:text-3xl">{settings.storeName}</span>
            )}
          </Link>

          <nav aria-label={t("nav.main")} className="ms-6 hidden flex-1 items-center gap-1 lg:flex">
            {links.map((l) => (
              <div key={l.href} className="group relative">
                <Link href={l.href} className="flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-bold hover:bg-primary/10">
                  {l.label}
                  {l.children && <Icon name="chevron-down" className="h-4 w-4 transition group-hover:rotate-180 group-focus-within:rotate-180" />}
                </Link>
                {l.children && l.children.length > 0 && (
                  <div className="invisible absolute start-0 top-full z-50 min-w-56 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="card p-2">
                      {l.children.map((c) => (
                        <li key={c.href}><Link href={c.href} className="block rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-primary/10">{c.label}</Link></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="ms-auto flex items-center">
            <SearchToggle />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}
