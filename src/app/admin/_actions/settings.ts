"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { getSettings, saveSettings, saveTheme } from "@/server/services/settings";
import { deleteImageFiles, logoExists } from "@/server/services/images";
import { formValues, invalid } from "@/server/admin/validation";
import { DEFAULT_PALETTE, normalizeHex, PALETTE_KEYS, type Palette } from "@/lib/palette";
import { normalizeDigits } from "@/lib/money";
import type { ActionState } from "@/lib/entity-types";

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).default("");

/** "@yasmeenworld", "instagram.com/x" or a full URL -> https://instagram.com/x (or an error). */
function normalizeInstagram(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  const handle = v.replace(/^@/, "");
  if (/^[A-Za-z0-9._]{1,30}$/.test(handle)) return `https://instagram.com/${handle}`;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (url.protocol === "https:" && /(^|\.)instagram\.com$/i.test(url.hostname)) return url.toString();
  } catch { /* fall through */ }
  return null;
}

const storeSchema = z
  .object({
    storeName: z.string().trim().min(1, "Enter the store name.").max(80),
    tagline: text(160),
    contactPhone: text(40),
    contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.").max(190)]).default(""),
    whatsappNumber: text(30),
    instagramUrl: text(200),
    announcement: text(160),
    aboutText: text(600),
    metaDescription: text(320),
    deliveryLeadDays: z.coerce.number().int("Whole days only.").min(0).max(30),
    deliveryMaxDays: z.coerce.number().int("Whole days only.").min(1).max(365),
    freeDeliveryThreshold: z.coerce.number().min(0, "Cannot be negative.").max(100_000),
  })
  .refine((v) => v.deliveryMaxDays >= v.deliveryLeadDays, { path: ["deliveryMaxDays"], message: "Must be at least the minimum notice." });

export async function saveStoreSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const get = (name: string) => String(form.get(name) ?? "");
  const parsed = storeSchema.safeParse({
    storeName: get("storeName"), tagline: get("tagline"), contactPhone: get("contactPhone"), contactEmail: get("contactEmail"),
    whatsappNumber: get("whatsappNumber"), instagramUrl: get("instagramUrl"), announcement: get("announcement"),
    aboutText: get("aboutText"), metaDescription: get("metaDescription"), deliveryLeadDays: get("deliveryLeadDays"),
    deliveryMaxDays: get("deliveryMaxDays"), freeDeliveryThreshold: get("freeDeliveryThreshold") || "0",
  });
  if (!parsed.success) return invalid(parsed.error, form);
  const v = parsed.data;

  // WhatsApp links need the number in international format, digits only.
  const whatsapp = normalizeDigits(v.whatsappNumber).replace(/[^\d]/g, "").replace(/^00/, "");
  if (v.whatsappNumber && (whatsapp.length < 8 || whatsapp.length > 15)) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { whatsappNumber: "Enter the full number with country code, e.g. 962791234567." }, values: formValues(form) };
  }
  const instagram = normalizeInstagram(v.instagramUrl);
  if (instagram === null) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { instagramUrl: "Enter your Instagram handle (@name) or profile link." }, values: formValues(form) };
  }

  await saveSettings({
    store_name: v.storeName, tagline: v.tagline, contact_phone: v.contactPhone, contact_email: v.contactEmail,
    whatsapp_number: whatsapp, instagram_url: instagram, announcement: v.announcement, about_text: v.aboutText,
    meta_description: v.metaDescription, delivery_lead_days: String(v.deliveryLeadDays), delivery_max_days: String(v.deliveryMaxDays),
    free_delivery_threshold: String(v.freeDeliveryThreshold), cod_enabled: form.get("codEnabled") === "on" ? "1" : "0",
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

/** Saves the colour palette and (optionally) switches the logo to one uploaded earlier. */
export async function saveThemeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(String(form.get("palette") ?? "{}"));
  } catch {
    return { error: "The palette could not be read. Reload the page and try again." };
  }
  const palette = { ...DEFAULT_PALETTE };
  for (const key of PALETTE_KEYS) {
    const hex = typeof raw[key] === "string" ? normalizeHex(raw[key] as string) : null;
    if (!hex) return { error: `The ${key} colour is not a valid hex colour.` };
    palette[key] = hex;
  }

  const current = await getSettings();
  const newLogo = String(form.get("logoKey") ?? "");
  const removeLogo = form.get("removeLogo") === "1";
  const values: Parameters<typeof saveSettings>[0] = { theme: JSON.stringify(palette satisfies Palette) };

  if (removeLogo) {
    values.logo_key = "";
  } else if (newLogo && newLogo !== current.logoKey) {
    if (!(await logoExists(newLogo))) return { error: "The uploaded logo was not found. Please upload it again." };
    values.logo_key = newLogo;
  }
  await saveSettings(values);
  if (values.logo_key !== undefined && current.logoKey && current.logoKey !== values.logo_key) await deleteImageFiles(current.logoKey);

  revalidatePath("/", "layout");
  return { ok: true, message: "Logo and colours saved. The whole site now uses this palette." };
}

export async function resetThemeAction(): Promise<void> {
  await requireAdmin();
  await saveTheme({ ...DEFAULT_PALETTE });
  revalidatePath("/", "layout");
}
