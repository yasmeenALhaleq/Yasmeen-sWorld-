"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

/** Sidebar on large screens, slide-in drawer on phones. */
export function AdminNav({ groups, storeName, signOut }: { groups: NavGroup[]; storeName: string; signOut: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <Link href="/admin" className="px-2 pt-1 font-serif text-2xl font-bold text-primary">
        {storeName}
        <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-ink/55">Dashboard</span>
      </Link>
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/50">{group.title}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isActive(item.href) ? "bg-primary text-on-primary" : "hover:bg-primary/10"
                  }`}
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? <span className="rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-bold text-white">{item.badge}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto space-y-1 border-t border-primary/10 pt-3">
        <Link href="/" target="_blank" className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-primary/10">
          <Icon name="external" className="h-[18px] w-[18px]" /> View store
        </Link>
        {signOut}
      </div>
    </nav>
  );

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-primary/10 bg-surface px-4 py-2 lg:hidden">
        <Link href="/admin" className="font-serif text-xl font-bold text-primary">{storeName}</Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <Icon name="menu" />
        </button>
      </div>

      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-e border-primary/10 bg-surface lg:block">{nav}</aside>

      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85vw] bg-surface shadow-xl">
            <button type="button" className="btn btn-ghost btn-sm absolute end-2 top-2" onClick={() => setOpen(false)} aria-label="Close menu">
              <Icon name="x" />
            </button>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
