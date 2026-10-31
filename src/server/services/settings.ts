import "server-only";
import { cache } from "react";
import { cached, clearCache } from "@/server/cache";
import { execute, query } from "@/server/db/pool";
import { DEFAULT_PALETTE, normalizeHex, PALETTE_KEYS, type Palette } from "@/lib/palette";

const PREVIOUS_DEFAULT_PALETTE: Palette = {
  primary: "#9B5478",
  secondary: "#D9A5BE",
  accent: "#7E9C86",
  background: "#F6E9EF",
  surface: "#FFFFFF",
  text: "#4A2338",
  button: "#9B5478",
  buttonHover: "#7F3F61",
};

export interface Settings {
  storeName: string;
  tagline: string;
  contactPhone: string;
  contactEmail: string;
  whatsappNumber: string;
  instagramUrl: string;
  logoKey: string;
  theme: Palette;
  announcement: string;
  aboutText: string;
  metaDescription: string;
  deliveryLeadDays: number;
  deliveryMaxDays: number;
  freeDeliveryThreshold: number;
  codEnabled: boolean;
  onlinePaymentsEnabled: boolean;
}

/** Database keys, in one place so forms and readers cannot drift apart. */
export type SettingKey =
  | "store_name" | "tagline" | "contact_phone" | "contact_email" | "whatsapp_number" | "instagram_url"
  | "logo_key" | "theme" | "announcement" | "about_text" | "meta_description"
  | "delivery_lead_days" | "delivery_max_days" | "free_delivery_threshold"
  | "cod_enabled" | "online_payments_enabled";

function parseTheme(raw: string | undefined): Palette {
  const theme: Palette = { ...DEFAULT_PALETTE };
  if (!raw) return theme;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof Palette, string>>;
    if (PALETTE_KEYS.every((key) => normalizeHex(parsed[key] ?? "") === PREVIOUS_DEFAULT_PALETTE[key])) {
      return theme;
    }
    for (const key of PALETTE_KEYS) {
      const hex = parsed[key] ? normalizeHex(parsed[key]!) : null;
      if (hex) theme[key] = hex;
    }
  } catch {
    // A corrupt theme value falls back to the defaults.
  }
  return theme;
}

const int = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

async function loadSettings(): Promise<Settings> {
  const rows = await query<{ setting_key: string; setting_value: string | null }>(
    "SELECT setting_key, setting_value FROM settings",
  );
  const m: Record<string, string> = {};
  for (const r of rows) m[r.setting_key] = r.setting_value ?? "";

  return {
    storeName: m.store_name || "Yasmeen World",
    tagline: m.tagline ?? "",
    contactPhone: m.contact_phone ?? "",
    contactEmail: m.contact_email ?? "",
    whatsappNumber: m.whatsapp_number ?? "",
    instagramUrl: m.instagram_url ?? "",
    logoKey: m.logo_key ?? "",
    theme: parseTheme(m.theme),
    announcement: m.announcement ?? "",
    aboutText: m.about_text ?? "",
    metaDescription: m.meta_description ?? "",
    deliveryLeadDays: Math.max(0, int(m.delivery_lead_days, 1)),
    deliveryMaxDays: Math.max(1, int(m.delivery_max_days, 60)),
    freeDeliveryThreshold: Math.max(0, int(m.free_delivery_threshold, 0)),
    codEnabled: m.cod_enabled !== "0",
    onlinePaymentsEnabled: m.online_payments_enabled === "1",
  };
}

/** Cached for 30 s and per request; admin saves clear the cache straight away. */
export const getSettings = cache(() => cached("settings", 30_000, loadSettings));

export async function saveSettings(values: Partial<Record<SettingKey, string>>): Promise<void> {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined) as [string, string][];
  for (const [key, value] of entries) {
    await execute(
      "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [key, value],
    );
  }
  clearCache("settings");
}

export async function saveTheme(theme: Palette): Promise<void> {
  await saveSettings({ theme: JSON.stringify(theme) });
}
