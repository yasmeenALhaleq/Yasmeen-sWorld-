"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/shop/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="btn btn-ghost relative !px-3" aria-label={t("nav.cart", { count: ready ? count : 0 })}>
      <Icon name="bag" className="h-6 w-6" />
      {ready && count > 0 && (
        <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-button px-1 text-[11px] font-extrabold text-on-button">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Search icon that opens a search bar under the header. Works as a normal GET form to /shop. */
export function SearchToggle() {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  return (
    <>
      <button type="button" className="btn btn-ghost !px-3" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-search" aria-label={t("nav.search")}>
        <Icon name={open ? "x" : "search"} className="h-6 w-6" />
      </button>
      {open && (
        <div id="site-search" className="absolute inset-x-0 top-full border-b border-primary/15 bg-surface shadow-lg">
          <form action="/shop" role="search" className="container-page flex items-center gap-3 py-3">
            <label htmlFor="site-search-input" className="sr-only">{t("nav.search")}</label>
            <input ref={input} id="site-search-input" name="q" type="search" className="input" placeholder={t("nav.searchPlaceholder")} autoComplete="off" onKeyDown={(e) => e.key === "Escape" && setOpen(false)} />
            <button className="btn btn-primary">{t("common.search")}</button>
          </form>
        </div>
      )}
    </>
  );
}

export interface MenuLink { label: string; href: string; children?: MenuLink[] }

/** Slide-in menu for phones and tablets. */
export function MobileMenu({ links, storeName }: { links: MenuLink[]; storeName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-ghost !px-3 lg:hidden" onClick={() => setOpen(true)} aria-expanded={open} aria-label={t("nav.menu")}>
        <Icon name="menu" className="h-6 w-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
          <button type="button" className="absolute inset-0 bg-ink/45" aria-label={t("common.close")} onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 start-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-surface p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-serif text-2xl font-bold text-primary">{storeName}</span>
              <button type="button" className="btn btn-ghost !px-2" onClick={() => setOpen(false)} aria-label={t("common.close")}><Icon name="x" /></button>
            </div>
            <ul className="space-y-1">
              {links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="flex min-h-12 items-center rounded-xl px-3 text-lg font-semibold hover:bg-primary/10">{l.label}</Link>
                  {l.children && (
                    <ul className="mb-2 ms-3 border-s-2 border-primary/15 ps-3">
                      {l.children.map((c) => (
                        <li key={c.href}><Link href={c.href} className="flex min-h-10 items-center rounded-lg px-3 text-base hover:bg-primary/10">{c.label}</Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
