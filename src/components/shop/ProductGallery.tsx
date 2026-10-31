"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/shop/ProductImage";
import { Icon } from "@/components/ui/Icon";
import { imageUrl } from "@/lib/images";
import { t } from "@/i18n";
import type { ImageRef } from "@/lib/types";

/**
 * Product pictures: thumbnails, hover-to-zoom on desktop, and a full-screen
 * viewer (tap / click) with keyboard and swipe navigation.
 */
export function ProductGallery({ images, name, badge }: { images: ImageRef[]; name: string; badge?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [viewer, setViewer] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | null>(null);
  const count = images.length;

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (!viewer) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(false);
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [viewer, index, go]);

  if (count === 0) {
    return <div className="relative">{badge}<ProductImage image={null} alt={name} className="aspect-square w-full rounded-3xl" /></div>;
  }

  const current = images[index];
  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setViewer(true)}
          onMouseMove={(e) => {
            if (!window.matchMedia("(hover: hover)").matches) return;
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          aria-label={t("gallery.enlarge")}
          className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-3xl bg-primary/5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(current.key, 1600)}
            srcSet={`${imageUrl(current.key, 800)} 800w, ${imageUrl(current.key, 1600)} 1600w`}
            sizes="(min-width: 1024px) 50vw, 100vw"
            alt={current.alt || name}
            fetchPriority="high"
            className="h-full w-full object-cover transition-transform duration-200 ease-out"
            style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            draggable={false}
          />
        </button>
        {badge}
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label={t("gallery.prev")}
              className="absolute start-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/85 shadow hover:bg-surface sm:hidden"><Icon name="chevron-left" className="rtl:rotate-180" /></button>
            <button type="button" onClick={() => go(index + 1)} aria-label={t("gallery.next")}
              className="absolute end-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/85 shadow hover:bg-surface sm:hidden"><Icon name="chevron-right" className="rtl:rotate-180" /></button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:gap-3" aria-label={t("gallery.thumbnails")}>
          {images.map((img, i) => (
            <li key={img.key}>
              <button type="button" onClick={() => setIndex(i)} aria-label={t("gallery.show", { n: i + 1 })} aria-current={i === index}
                className={`block aspect-square w-full overflow-hidden rounded-2xl border-2 transition ${i === index ? "border-primary" : "border-transparent opacity-75 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(img.key, 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={name}
          onClick={(e) => { if (e.target === e.currentTarget) setViewer(false); }}
          onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
            touchStart.current = null;
          }}>
          <button ref={closeButton} type="button" onClick={() => setViewer(false)} aria-label={t("common.close")}
            className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-lg"><Icon name="x" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(current.key, 1600)} alt={current.alt || name} className="max-h-full max-w-full rounded-2xl object-contain" />
          {count > 1 && (
            <>
              <button type="button" onClick={() => go(index - 1)} aria-label={t("gallery.prev")}
                className="absolute start-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-lg"><Icon name="chevron-left" className="rtl:rotate-180" /></button>
              <button type="button" onClick={() => go(index + 1)} aria-label={t("gallery.next")}
                className="absolute end-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-lg"><Icon name="chevron-right" className="rtl:rotate-180" /></button>
              <p className="absolute bottom-4 start-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-xs font-bold text-ink rtl:translate-x-1/2">{index + 1} / {count}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
