import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/services/settings";
import { logoUrl } from "@/lib/images";
import { CornerSprigs } from "@/components/ui/Botanical";

export const metadata: Metadata = {
  title: { default: "Admin sign in", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

/** Centered card layout shared by the sign-in, forgot-password and reset-password pages. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-page px-4 py-10">
      <CornerSprigs />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 flex flex-col items-center gap-2 text-center">
          {settings.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl(settings.logoKey)} alt={settings.storeName} className="h-16 w-auto" />
          ) : (
            <span className="font-serif text-4xl font-bold text-primary">{settings.storeName}</span>
          )}
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-ink/60">Store administration</span>
        </Link>
        <div className="card card-pad">{children}</div>
        <p className="mt-6 text-center text-sm text-ink/60">
          <Link href="/" className="underline underline-offset-2">Back to the store</Link>
        </p>
      </div>
    </div>
  );
}
