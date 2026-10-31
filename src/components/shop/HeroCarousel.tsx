"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CornerSprigs } from "@/components/ui/Botanical";
import { Icon } from "@/components/ui/Icon";
import { imageSrcSet, imageUrl } from "@/lib/images";
import { t } from "@/i18n";

export interface HeroSlide {
  id: number;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  imageKey: string | null;
}

const AUTOPLAY_MS = 6500;

/** Home page banner(s). One banner is shown statically; several rotate. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback((n: number) => setIndex((n + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, paused, go]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("home.banners")}
      className="relative overflow-hidden bg-gradient-to-br from-secondary/40 via-page to-accent/25"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative">
        {slides.map((s, i) => {
          const active = i === index;
          const hasImage = Boolean(s.imageKey);
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              className={`${active ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"} transition-opacity duration-700`}
            >
              <div className="relative flex min-h-[26rem] items-center sm:min-h-[32rem] lg:min-h-[36rem]">
                {hasImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(s.imageKey!, 1600)}
                    srcSet={imageSrcSet(s.imageKey!)}
                    sizes="100vw"
                    alt=""
                    fetchPriority={i === 0 ? "high" : undefined}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                {hasImage ? (
                  <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/40 to-transparent rtl:bg-gradient-to-l" aria-hidden="true" />
                ) : (
                  <CornerSprigs />
                )}
                <div className={`container-page relative py-14 ${hasImage ? "text-white" : "text-ink"}`}>
                  <div className="max-w-xl">
                    <h1 className="text-balance !text-5xl sm:!text-6xl lg:!text-7xl">{s.title}</h1>
                    {s.subtitle && <p className="mt-4 max-w-md text-lg opacity-90">{s.subtitle}</p>}
                    {s.buttonText && s.buttonUrl && (
                      <Link href={s.buttonUrl} className="btn btn-primary btn-lg mt-7" tabIndex={active ? 0 : -1}>
                        {s.buttonText}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        // Controls sit in their own bar at the bottom so they never cover the banner text.
        <div className="pointer-events-none absolute inset-x-0 bottom-4">
          <div className="container-page flex items-center justify-between">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/80 px-3 py-2 backdrop-blur">
              {slides.map((s, i) => (
                <button key={s.id} type="button" onClick={() => setIndex(i)} aria-label={`${t("home.goToBanner")} ${i + 1}`} aria-current={i === index}
                  className={`h-2.5 rounded-full transition-all ${i === index ? "w-8 bg-primary" : "w-2.5 bg-primary/35 hover:bg-primary/60"}`} />
              ))}
            </div>
            <div className="pointer-events-auto flex gap-2">
              <button type="button" onClick={() => go(index - 1)} aria-label={t("home.prevBanner")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 shadow-md hover:bg-surface">
                <Icon name="chevron-left" className="rtl:rotate-180" />
              </button>
              <button type="button" onClick={() => go(index + 1)} aria-label={t("home.nextBanner")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 shadow-md hover:bg-surface">
                <Icon name="chevron-right" className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
