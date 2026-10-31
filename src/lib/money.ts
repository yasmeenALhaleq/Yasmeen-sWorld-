// Money helpers. The Jordanian Dinar has 3 decimal places (1 JOD = 1000 fils),
// so every amount is rounded to 3 decimals to avoid floating point drift.

export const CURRENCY = "JOD";

/** Round to whole fils (3 decimals). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** "12.500 JOD". The currency code is kept separate so it can be localized later. */
export function formatMoney(n: number): string {
  return `${roundMoney(n).toFixed(3)} ${CURRENCY}`;
}

/** Converts Arabic-Indic / Persian digits to ASCII so admins can type either. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

/** Parses a user-typed amount. Returns null when it is not a valid non-negative number. */
export function parseMoney(input: string): number | null {
  const cleaned = normalizeDigits(input).trim().replace(/,/g, ".");
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  return roundMoney(Number(cleaned));
}
