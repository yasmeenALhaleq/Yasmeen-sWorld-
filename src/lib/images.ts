// URL helpers for uploaded images. Every upload is stored in three widths
// (see src/server/services/images.ts) so the browser can pick the right one.

export const IMAGE_WIDTHS = [400, 800, 1600] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

export function imageUrl(key: string, width: ImageWidth = 800): string {
  return `/uploads/${key}-${width}.webp`;
}

export function imageSrcSet(key: string): string {
  return IMAGE_WIDTHS.map((w) => `${imageUrl(key, w)} ${w}w`).join(", ");
}

export function logoUrl(key: string): string {
  return `/uploads/${key}-logo.png`;
}

export function iconUrl(key: string): string {
  return `/uploads/${key}-icon.png`;
}

/** Filenames the /uploads route is allowed to serve. */
export const UPLOAD_FILE_PATTERN = /^[a-f0-9]{24}-(?:400|800|1600)\.webp$|^[a-f0-9]{24}-(?:logo|icon)\.png$/;
