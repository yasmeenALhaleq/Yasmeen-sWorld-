import type { Metadata, Viewport } from "next";
import "@fontsource-variable/alexandria/wght.css";
import "./globals.css";
import { getSettings } from "@/server/services/settings";
import { env } from "@/server/env";
import { iconUrl } from "@/lib/images";
import { paletteToCss } from "@/lib/palette";
import { DEFAULT_LOCALE, LOCALE_DIR } from "@/i18n";

// Everything is rendered per request: prices, stock and the saved theme come
// from the database. (Short in-process caches keep this fast.)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: `${s.storeName} | ${s.tagline}`, template: `%s | ${s.storeName}` },
    description: s.metaDescription || s.tagline,
    applicationName: s.storeName,
    icons: s.logoKey ? { icon: iconUrl(s.logoKey), apple: iconUrl(s.logoKey) } : undefined,
    openGraph: { type: "website", siteName: s.storeName, locale: "en_JO" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const s = await getSettings();
  return { width: "device-width", initialScale: 1, themeColor: s.theme.primary };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang={DEFAULT_LOCALE} dir={LOCALE_DIR[DEFAULT_LOCALE]}>
      <head>
        {/* The saved palette, rendered on the server so there is no flash of default colours. */}
        <style id="bw-theme" dangerouslySetInnerHTML={{ __html: paletteToCss(settings.theme) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
