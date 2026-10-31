import Link from "next/link";
import { Blossom, CornerSprigs } from "@/components/ui/Botanical";
import { t } from "@/i18n";

export default function ShopNotFound() {
  return (
    <section className="relative overflow-hidden">
      <CornerSprigs />
      <div className="container-page relative flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
        <Blossom className="mb-4 h-14 w-14 text-primary/60" />
        <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-accent">404</p>
        <h1 className="mt-2 text-balance">{t("notFound.title")}</h1>
        <p className="mt-3 max-w-md text-ink/75">{t("notFound.text")}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary btn-lg">{t("notFound.home")}</Link>
          <Link href="/shop" className="btn btn-outline btn-lg">{t("nav.shop")}</Link>
        </div>
      </div>
    </section>
  );
}
