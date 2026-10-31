/** Uploads one image to the admin upload endpoint. Throws an Error with a readable message. */
export async function uploadImage(file: File, kind: "image" | "logo" = "image"): Promise<{ key: string; url: string }> {
  const body = new FormData();
  body.set("file", file);
  let res: Response;
  try {
    res = await fetch(`/api/admin/upload?kind=${kind}`, { method: "POST", body });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (res.status === 401) {
    window.location.assign("/admin/login?timeout=1");
    throw new Error("Please sign in again.");
  }
  const data = (await res.json().catch(() => ({}))) as { key?: string; url?: string; error?: string };
  if (!res.ok || !data.key || !data.url) throw new Error(data.error || "The upload failed.");
  return { key: data.key, url: data.url };
}

/** Accepts image files only and returns a message for anything else. */
export function checkImageFile(file: File, allowSvg = false): string | null {
  const ok = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.type) || (allowSvg && file.type === "image/svg+xml");
  if (!ok) return allowSvg ? "Please choose a PNG, JPG, WebP or SVG image." : "Please choose a JPG, PNG, WebP or GIF image.";
  if (file.size > 12 * 1024 * 1024) return "That image is larger than 12 MB.";
  return null;
}
