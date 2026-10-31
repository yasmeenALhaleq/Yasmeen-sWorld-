import Link from "next/link";
import type { Metadata } from "next";
import { HeroCarousel } from "@/components/shop/HeroCarousel";
import { ProductGrid } from "@/components/shop/ProductCard";
import { Blossom, CornerSprigs } from "@/components/ui/Botanical";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { imageUrl } from "@/lib/images";
import { getBestSellers, getCategoryCounts, getFeatured, getReadyGifts, getTaxonomy } from "@/server/services/catalog";
import { getHomeContent } from "@/server/services/gifts";
import { getSettings } from "@/server/services/settings";
import { t, type MessageKey } from "@/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { absolute: `${s.storeName} | ${s.tagline}` },
    description: s.metaDescription || s.tagline,
    alternates: { canonical: "/" },
  };
}

const PROMISES: { icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { icon: "leaf", title: "home.promise.natural", text: "home.promise.naturalText" },
  { icon: "heart", title: "home.promise.handmade", text: "home.promise.handmadeText" },
  { icon: "gift", title: "home.promise.wrapped", text: "home.promise.wrappedText" },
  { icon: "truck", title: "home.promise.delivery", text: "home.promise.deliveryText" },
];

const BUILD_STEPS: MessageKey[] = [
  "builder.step.occasion", "builder.step.base", "builder.step.products", "builder.step.wrap", "builder.step.card", "builder.step.review",
];

export default async function HomePage() {
  const [settings, taxonomy, counts, content, featured, bestSellers, gifts] = await Promise.all([
    getSettings(), getTaxonomy(), getCategoryCounts(), getHomeContent(), getFeatured(8), getBestSellers(4), getReadyGifts(4),
  ]);

  const best = bestSellers;

  return (
    <>
      {content.banners.length > 0 ? (
        <HeroCarousel slides={content.banners} />
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-br from-secondary/40 via-page to-accent/25">
          <CornerSprigs />
          <div className="container-page relative flex min-h-[26rem] flex-col items-center justify-center py-16 text-center sm:min-h-[32rem]">
            <Blossom className="mb-4 h-10 w-10 text-primary" />
            <h1 className="max-w-3xl text-balance !text-5xl sm:!text-6xl lg:!text-7xl">{settings.tagline || t("home.hero.title")}</h1>
            <p className="mt-4 max-w-xl text-lg text-ink/80">{t("home.hero.text")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/shop" className="btn btn-primary btn-lg">{t("home.hero.shop")}</Link>
              <Link href="/gifts/build" className="btn btn-outline btn-lg">{t("nav.buildGift")}</Link>
            </div>
          </div>
        </section>
      )}

      <section aria-label={t("home.promise.label")} className="border-y border-primary/10 bg-surface">
        <ul className="container-page grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon name={p.icon} className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-extrabold">{t(p.title)}</span>
                <span className="block text-xs text-ink/70 sm:text-sm">{t(p.text)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {taxonomy.categories.length > 0 && (
        <section className="section container-page" aria-labelledby="cats-title">
          <SectionHeading id="cats-title" eyebrow={t("home.categories.eyebrow")} title={t("home.categories.title")} />
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-5">
            {taxonomy.categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-secondary/40 to-accent/30 shadow-soft">
                  {c.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl(c.imageKey, 800)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <Blossom className="absolute start-1/2 top-[38%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-primary/35 rtl:translate-x-1/2" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-4 pt-12 text-white">
                    <span className="block font-serif text-xl font-semibold leading-tight">{c.name}</span>
                    <span className="text-xs opacity-85">{t("home.categories.count", { count: counts.get(c.id) ?? 0 })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section className="section bg-surface/60" aria-labelledby="featured-title">
          <div className="container-page">
            <SectionHeading id="featured-title" eyebrow={t("home.featured.eyebrow")} title={t("home.featured.title")} href="/shop" />
            <ProductGrid products={featured} priorityCount={4} />
          </div>
        </section>
      )}

      {taxonomy.occasions.length > 0 && (
        <section className="section container-page" aria-labelledby="occ-title">
          <SectionHeading id="occ-title" eyebrow={t("home.occasions.eyebrow")} title={t("home.occasions.title")} subtitle={t("home.occasions.text")} />
          <ul className="flex flex-wrap justify-center gap-3">
            {taxonomy.occasions.map((o) => (
              <li key={o.id}>
                <Link href={`/gifts?occasion=${o.slug}`} className="chip !min-h-12 !px-6 !text-base">
                  <Blossom className="h-4 w-4 text-primary" />
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {best.length > 0 && (
        <section className="section bg-surface/60" aria-labelledby="best-title">
          <div className="container-page">
            <SectionHeading id="best-title" eyebrow={t("home.best.eyebrow")} title={t("home.best.title")} href="/shop?sort=best" hrefLabel={t("home.best.all")} />
            <ProductGrid products={best} />
          </div>
        </section>
      )}

      {gifts.length > 0 && (
        <section className="section container-page" aria-labelledby="gifts-title">
          <SectionHeading id="gifts-title" eyebrow={t("home.gifts.eyebrow")} title={t("home.gifts.title")} subtitle={t("home.gifts.text")} href="/gifts" hrefLabel={t("home.gifts.all")} />
          <ProductGrid products={gifts} />
        </section>
      )}

      <section className="relative overflow-hidden bg-primary text-on-primary" aria-labelledby="build-title">
        <CornerSprigs className="!text-on-primary" />
        <div className="container-page relative grid items-center gap-8 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.25em] opacity-80">{t("home.build.eyebrow")}</p>
            <h2 id="build-title" className="text-balance !text-4xl sm:!text-5xl">{t("home.build.title")}</h2>
            <p className="mt-4 max-w-md text-lg opacity-90">{t("home.build.text")}</p>
            <Link href="/gifts/build" className="btn btn-lg mt-7 bg-surface text-ink hover:bg-page">{t("home.build.cta")}</Link>
          </div>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BUILD_STEPS.map((s, i) => (
              <li key={s} className="rounded-2xl bg-surface/15 p-4 backdrop-blur-sm">
                <span className="font-serif text-3xl font-bold opacity-80">{i + 1}</span>
                <span className="block text-sm font-bold">{t(s)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {content.testimonials.length > 0 && (
        <section className="section container-page" aria-labelledby="test-title">
          <SectionHeading id="test-title" eyebrow={t("home.testimonials.eyebrow")} title={t("home.testimonials.title")} />
          <ul className="grid gap-5 md:grid-cols-3">
            {content.testimonials.slice(0, 6).map((q) => (
              <li key={q.id}>
                <figure className="card card-pad flex h-full flex-col">
                  <div className="mb-3 flex gap-0.5 text-primary" role="img" aria-label={t("home.testimonials.rating", { rating: q.rating })}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Icon key={i} name="star" className={`h-4 w-4 ${i < q.rating ? "fill-current" : "opacity-25"}`} />
                    ))}
                  </div>
                  <blockquote className="flex-1 font-serif text-xl italic leading-snug">“{q.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm font-bold">
                    {q.authorName}
                    {q.location && <span className="font-normal text-ink/65"> · {q.location}</span>}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      {settings.instagramUrl && (
        <section className="section container-page pt-0" aria-labelledby="insta-title">
          <div className="card card-pad relative overflow-hidden text-center">
            <CornerSprigs />
            <div className="relative">
              <Icon name="instagram" className="mx-auto mb-3 h-9 w-9 text-primary" />
              <h2 id="insta-title" className="!text-4xl">{t("home.instagram.title")}</h2>
              <p className="mx-auto mt-2 max-w-md text-ink/75">{t("home.instagram.text")}</p>
              <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-lg mt-6">
                {t("home.instagram.cta")}
              </a>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
