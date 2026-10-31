import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import { orderStatusCounts } from "@/server/services/orders";
import { logoutAction } from "@/app/admin/_actions/auth";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { IdleLogout } from "@/components/admin/IdleLogout";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

// Every page under /admin (except the login screens) is rendered inside this
// layout, which refuses to render anything unless an admin is signed in.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [settings, counts] = await Promise.all([getSettings(), orderStatusCounts()]);

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/admin", label: "Overview", icon: "home" },
        { href: "/admin/orders", label: "Orders", icon: "package", badge: counts.new },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/admin/products", label: "Products", icon: "bag" },
        { href: "/admin/categories", label: "Categories", icon: "layers" },
        { href: "/admin/occasions", label: "Occasions", icon: "calendar" },
        { href: "/admin/scents", label: "Scents", icon: "leaf" },
      ],
    },
    {
      title: "Sales",
      items: [
        { href: "/admin/discounts", label: "Discounts & offers", icon: "tag" },
        { href: "/admin/coupons", label: "Coupon codes", icon: "gift" },
        { href: "/admin/gift-builder", label: "Gift builder", icon: "heart" },
      ],
    },
    {
      title: "Website",
      items: [
        { href: "/admin/home", label: "Home page", icon: "star" },
        { href: "/admin/delivery", label: "Delivery fees", icon: "truck" },
        { href: "/admin/appearance", label: "Logo & colours", icon: "palette" },
        { href: "/admin/settings", label: "Store settings", icon: "sliders" },
        { href: "/admin/account", label: "My account", icon: "user" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-page lg:flex">
      <AdminNav
        groups={groups}
        storeName={settings.storeName}
        signOut={
          <form action={logoutAction}>
            <button type="submit" className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-semibold hover:bg-primary/10">
              <Icon name="log-out" className="h-[18px] w-[18px]" /> Sign out
              <span className="ms-auto max-w-[7rem] truncate text-xs font-normal text-ink/55">{admin.name || admin.email}</span>
            </button>
          </form>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <IdleLogout idleMs={admin.idleMs} />
    </div>
  );
}
