import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, dayBoundsUtc, parseLocalInput, toLocalInput, todayIn, zonedToUtc } from "../../src/lib/time.ts";
import { slugify } from "../../src/lib/slug.ts";

test("Amman wall-clock time converts to UTC (UTC+3) and back", () => {
  const utc = parseLocalInput("2026-03-05T14:30", "Asia/Amman");
  assert.equal(utc?.toISOString(), "2026-03-05T11:30:00.000Z");
  assert.equal(toLocalInput(utc, "Asia/Amman"), "2026-03-05T14:30");
  assert.equal(parseLocalInput("", "Asia/Amman"), null);
});

test("a store day starts at 21:00 UTC the previous evening", () => {
  const { start, end } = dayBoundsUtc("2026-03-05", "Asia/Amman");
  assert.equal(start.toISOString(), "2026-03-04T21:00:00.000Z");
  assert.equal(end.toISOString(), "2026-03-05T21:00:00.000Z");
});

test("todayIn uses the store time zone, not UTC", () => {
  // 22:30 UTC is already the next day in Amman.
  assert.equal(todayIn("Asia/Amman", new Date("2026-03-05T22:30:00Z")), "2026-03-06");
  assert.equal(todayIn("UTC", new Date("2026-03-05T22:30:00Z")), "2026-03-05");
});

test("zones with daylight saving time resolve correctly", () => {
  assert.equal(zonedToUtc(2026, 7, 1, 12, 0, "America/New_York").toISOString(), "2026-07-01T16:00:00.000Z");
  assert.equal(zonedToUtc(2026, 1, 1, 12, 0, "America/New_York").toISOString(), "2026-01-01T17:00:00.000Z");
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("slugify handles accents, apostrophes, punctuation and Arabic", () => {
  assert.equal(slugify("Mother's Day"), "mothers-day");
  assert.equal(slugify("  Lavender & Rose Scrub (250 g) "), "lavender-rose-scrub-250-g");
  assert.equal(slugify("Crème brûlée"), "creme-brulee");
  assert.equal(slugify("صابون الورد"), "صابون-الورد");
  assert.equal(slugify("!!!", "item"), "item");
});
