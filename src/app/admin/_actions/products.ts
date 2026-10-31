"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import {
  deleteProduct, duplicateProduct, saveProduct, setProductFlag, type ProductInput,
} from "@/server/services/admin-products";
import { invalid } from "@/server/admin/validation";
import type { ActionState } from "@/lib/entity-types";

const money = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(100_000, `${label} is too large.`);
const count = (label: string) =>
  z.number({ error: `${label} must be a whole number.` }).int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`).max(1_000_000);

const productSchema = z.object({
  name: z.string().trim().min(2, "Enter the product name.").max(200),
  slug: z.string().trim().max(160).default(""),
  shortDescription: z.string().trim().max(300, "Keep the short description under 300 characters.").default(""),
  description: z.string().max(60_000, "The description is too long.").default(""),
  ingredients: z.string().trim().max(4000).default(""),
  howToUse: z.string().trim().max(4000).default(""),
  sizeLabel: z.string().trim().max(80).default(""),
  categoryId: z.number().int().positive().nullable(),
  scentId: z.number().int().positive().nullable(),
  optionName: z.string().trim().max(60).default(""),
  price: money("Price"),
  trackStock: z.boolean(),
  stockQuantity: count("Stock"),
  lowStockThreshold: count("Low-stock alert level"),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  inBuilder: z.boolean(),
  metaTitle: z.string().trim().max(160).default(""),
  metaDescription: z.string().trim().max(320).default(""),
  occasionIds: z.array(z.number().int().positive()).max(50),
  images: z.array(z.object({ key: z.string().regex(/^[a-f0-9]{24}$/), alt: z.string().trim().max(200).default("") })).max(12, "At most 12 pictures."),
  variants: z
    .array(
      z.object({
        id: z.number().int().positive().nullable(),
        label: z.string().trim().min(1, "Every option needs a name.").max(120),
        scentId: z.number().int().positive().nullable(),
        priceDelta: z.number().min(-100_000).max(100_000),
        stockQuantity: count("Option stock"),
        isActive: z.boolean(),
      }),
    )
    .max(40, "At most 40 options."),
});

/** The product form posts one JSON document in the `payload` field. */
export async function saveProductAction(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "The form data was not valid. Reload the page and try again." };
  }
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const data: ProductInput = parsed.data;

  let savedId: number;
  try {
    savedId = await saveProduct(data, id);
  } catch (err) {
    console.error("[admin] saving product failed:", err);
    return { error: "The product could not be saved. Please try again." };
  }
  revalidatePath("/admin/products");
  if (!id) redirect(`/admin/products/${savedId}?created=1`);
  return { ok: true, message: "Product saved." };
}

export async function toggleProductAction(id: number, flag: "is_active" | "is_featured" | "in_builder", value: boolean): Promise<void> {
  await requireAdmin();
  await setProductFlag(id, flag, value);
  revalidatePath("/admin", "layout");
}

export async function duplicateProductAction(id: number): Promise<void> {
  await requireAdmin();
  const newId = await duplicateProduct(id);
  if (newId) redirect(`/admin/products/${newId}?duplicated=1`);
}

export async function deleteProductAction(id: number): Promise<void> {
  await requireAdmin();
  await deleteProduct(id);
  revalidatePath("/admin/products");
  redirect("/admin/products?deleted=1");
}
