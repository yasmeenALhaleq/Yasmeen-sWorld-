import { Blossom } from "@/components/ui/Botanical";
import { imageSrcSet, imageUrl } from "@/lib/images";
import type { ImageRef } from "@/lib/types";

/** Responsive product picture (400 / 800 / 1600 px variants) or a soft placeholder. */
export function ProductImage({
  image,
  alt,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  className = "",
  priority = false,
}: {
  image: ImageRef | null;
  alt?: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  if (!image) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-secondary/30 to-accent/25 text-primary/50 ${className}`} role="img" aria-label={alt ?? ""}>
        <Blossom className="h-1/3 w-1/3 max-h-24 max-w-24" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(image.key, 800)}
      srcSet={imageSrcSet(image.key)}
      sizes={sizes}
      alt={alt ?? image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
}
