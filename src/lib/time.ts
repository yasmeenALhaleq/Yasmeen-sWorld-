// Time zone helpers. The database stores UTC; the shop runs on Jordan time.
// Admin forms use <input type="datetime-local">, which has no time zone, so
// we convert explicitly between that "wall clock" value and UTC.

export const DEFAULT_TIMEZONE = "Asia/Amman";

function parts(date: Date, timeZone: string): Record<string, number> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

/** Offset (in minutes) of `timeZone` from UTC at the given instant. */
export function offsetMinutes(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Converts a wall-clock time in `timeZone` to the matching UTC instant. */
export function zonedToUtc(
  y: number, m: number, d: number, hh: number, mm: number, timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let result = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  // Second pass handles zones that observe daylight saving time.
  result = guess - offsetMinutes(new Date(result), timeZone) * 60000;
  return new Date(result);
}

/** "2026-03-05T14:30" (datetime-local value, store time) -> UTC Date. Empty -> null. */
export function parseLocalInput(value: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return zonedToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), timeZone);
}

/** UTC Date -> "2026-03-05T14:30" in store time, for datetime-local inputs. */
export function toLocalInput(date: Date | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!date) return "";
  const p = parts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today's calendar date in store time, as "YYYY-MM-DD". */
export function todayIn(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  const p = parts(now, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Adds whole days to a "YYYY-MM-DD" string. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** UTC start (inclusive) and end (exclusive) of a store-time calendar day. */
export function dayBoundsUtc(ymd: string, timeZone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = addDays(ymd, 1).split("-").map(Number);
  return {
    start: zonedToUtc(y, m, d, 0, 0, timeZone),
    end: zonedToUtc(next[0], next[1], next[2], 0, 0, timeZone),
  };
}

export function formatDateTime(date: Date, timeZone: string = DEFAULT_TIMEZONE, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Formats a "YYYY-MM-DD" delivery date (a date, not an instant). */
export function formatDay(ymd: string, locale = "en-GB"): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}
