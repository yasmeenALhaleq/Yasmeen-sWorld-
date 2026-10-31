// URL slugs. Keeps any Unicode letter or digit so Arabic names still produce
// readable URLs once Arabic content is added.

export function slugify(text: string, fallback = "item"): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip Latin accents
    .toLowerCase()
    .replace(/['’`]/g, "") // "mother's" -> "mothers"
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return slug || fallback;
}
