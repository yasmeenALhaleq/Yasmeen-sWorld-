import type { MetadataRoute } from "next";
import { query } from "@/server/db/pool";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/** Lists every public page so search engines can find all products and categories. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, occasions] = await Promise.all([
    query<{ slug: string; updated_at: Date }>("SELECT slug, updated_at FROM products WHERE is_active = 1"),
    query<{ slug: string }>("SELECT slug FROM categories WHERE is_active = 1"),
    query<{ slug: string }>("SELECT slug FROM occasions WHERE is_active = 1"),
  ]);
  const abs = (path: string) => `${env.siteUrl}${path}`;

  return [
    { url: abs("/"), changeFrequency: "daily", priority: 1 },
    { url: abs("/shop"), changeFrequency: "daily", priority: 0.9 },
    { url: abs("/gifts"), changeFrequency: "weekly", priority: 0.9 },
    { url: abs("/gifts/build"), changeFrequency: "monthly", priority: 0.8 },
    ...categories.map((c) => ({ url: abs(`/category/${encodeURI(c.slug)}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...occasions.map((o) => ({ url: abs(`/gifts?occasion=${encodeURIComponent(o.slug)}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: abs(`/product/${encodeURI(p.slug)}`), lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
