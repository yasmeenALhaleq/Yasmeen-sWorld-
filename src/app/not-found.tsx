import Link from "next/link";
import { t } from "@/i18n";

// Shown for addresses that match no page at all (the shop pages have their own, richer version).
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-accent">404</p>
      <h1 className="mt-2">{t("notFound.title")}</h1>
      <p className="mt-3 max-w-md text-ink/75">{t("notFound.text")}</p>
      <Link href="/" className="btn btn-primary btn-lg mt-7">{t("notFound.home")}</Link>
    </div>
  );
}
