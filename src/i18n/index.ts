// Minimal i18n layer. All customer-facing text lives in a message dictionary
// (en.ts) and is read through t(), so adding Arabic later means:
//   1. create src/i18n/ar.ts with the same keys,
//   2. make getMessages() pick the dictionary for the visitor's locale
//      (cookie / URL prefix), and
//   3. set LOCALE_DIR to "rtl" for Arabic.
// The layout already writes <html lang dir>, and the CSS uses logical
// properties (margin-inline-start, text-align: start ...) so RTL flips cleanly.
import { en } from "./en.ts";

export type MessageKey = keyof typeof en;
export type Locale = "en" | "ar";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = { en: "ltr", ar: "rtl" };

const dictionaries: Record<Locale, Record<string, string>> = { en, ar: en /* TODO: ar.ts */ };

export function t(key: MessageKey, params?: Record<string, string | number>, locale: Locale = DEFAULT_LOCALE): string {
  const template = dictionaries[locale][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
