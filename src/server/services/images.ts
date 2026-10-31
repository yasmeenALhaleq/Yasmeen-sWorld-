import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/server/env";
import { IMAGE_WIDTHS } from "@/lib/images";

// Uploads are re-encoded: resized to three widths, converted to WebP, EXIF
// stripped (location data!) and auto-rotated. Re-encoding also guarantees that
// only real raster images are ever stored, whatever the uploaded file claimed.

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);
const LOGO_FORMATS = new Set([...ALLOWED_FORMATS, "svg"]);
const MAX_PIXELS = 60_000_000; // decompression-bomb guard

export class ImageError extends Error {}

const newKey = () => crypto.randomBytes(12).toString("hex"); // 24 hex chars

async function ensureDir() {
  await fs.mkdir(env.uploadDir, { recursive: true });
}

async function inspect(buffer: Buffer, allowed: Set<string>) {
  if (buffer.length === 0) throw new ImageError("The file is empty.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new ImageError("The image is larger than 12 MB.");
  try {
    const meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
    if (!meta.format || !allowed.has(meta.format)) {
      throw new ImageError(
        allowed.has("svg") ? "Please upload a PNG, JPG, WebP or SVG image." : "Please upload a JPG, PNG, WebP or GIF image.",
      );
    }
    return meta;
  } catch (err) {
    if (err instanceof ImageError) throw err;
    throw new ImageError("This file could not be read as an image.");
  }
}

/** Stores a product / banner / category image in 3 sizes and returns its key. */
export async function saveImage(buffer: Buffer): Promise<{ key: string; width: number; height: number }> {
  const meta = await inspect(buffer, ALLOWED_FORMATS);
  await ensureDir();
  const key = newKey();

  // animated GIFs: keep the first frame only.
  const base = sharp(buffer, { limitInputPixels: MAX_PIXELS }).rotate();
  await Promise.all(
    IMAGE_WIDTHS.map((w) =>
      base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(path.join(env.uploadDir, `${key}-${w}.webp`)),
    ),
  );
  return { key, width: meta.width ?? 0, height: meta.height ?? 0 };
}

/**
 * Stores the brand logo. SVG logos are rasterised to PNG on purpose: an SVG
 * file served from our own domain could carry scripts. A 2x PNG is crisp
 * enough for the header and keeps things safe.
 */
export async function saveLogo(buffer: Buffer): Promise<{ key: string }> {
  const meta = await inspect(buffer, LOGO_FORMATS);
  await ensureDir();
  const key = newKey();
  const input =
    meta.format === "svg"
      ? sharp(buffer, { density: 288, limitInputPixels: MAX_PIXELS })
      : sharp(buffer, { limitInputPixels: MAX_PIXELS }).rotate();

  await input
    .clone()
    .resize({ width: 800, height: 400, fit: "inside", withoutEnlargement: meta.format !== "svg" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(env.uploadDir, `${key}-logo.png`));

  // Square favicon / app icon.
  await input
    .clone()
    .resize({ width: 128, height: 128, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(env.uploadDir, `${key}-icon.png`));

  return { key };
}

const KEY_PATTERN = /^[a-f0-9]{24}$/;

/** Removes every file belonging to an image / logo key. Missing files are ignored. */
export async function deleteImageFiles(key: string | null | undefined): Promise<void> {
  if (!key || !KEY_PATTERN.test(key)) return;
  const names = [...IMAGE_WIDTHS.map((w) => `${key}-${w}.webp`), `${key}-logo.png`, `${key}-icon.png`];
  await Promise.all(
    names.map(async (name) => {
      try {
        // On Windows a file that was just served can be locked for a moment
        // (OneDrive, antivirus), so retry a few times.
        await fs.rm(path.join(env.uploadDir, name), { force: true, maxRetries: 6, retryDelay: 150 });
      } catch (err) {
        // Never let leftover files break the action that triggered the cleanup.
        console.warn(`[images] could not delete ${name} (${(err as { code?: string }).code ?? "error"}). Run "npm run uploads:cleanup" later.`);
      }
    }),
  );
}

/** True when the logo files for `key` exist (guards against saving a bogus logo key). */
export async function logoExists(key: string): Promise<boolean> {
  if (!KEY_PATTERN.test(key)) return false;
  try {
    await fs.access(path.join(env.uploadDir, `${key}-logo.png`));
    return true;
  } catch {
    return false;
  }
}

export const isImageKey =(value: unknown): value is string => typeof value === "string" && KEY_PATTERN.test(value);
