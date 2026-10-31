import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { en } from "../../src/i18n/en.ts";
import { t } from "../../src/i18n/index.ts";

const SRC = path.resolve(import.meta.dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && entry.name !== "en.ts" ? [full] : [];
  });
}

const NAMESPACES = Object.keys(en).map((k) => k.split(".")[0]);
const KEY_LITERAL = new RegExp(`"((?:${[...new Set(NAMESPACES)].join("|")})\\.[A-Za-z0-9_.]+)"`, "g");

test("every message key used in the code exists in the dictionary", () => {
  const missing: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(KEY_LITERAL)) {
      if (!(match[1] in en)) missing.push(`${path.relative(SRC, file)}: ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("t() fills {placeholders} and leaves unknown ones visible", () => {
  assert.equal(t("order.thanks", { name: "Lina" }), "Thank you, Lina!");
  assert.equal(t("product.onlyLeft", { count: 3 }), "Only 3 left");
  assert.equal(t("order.thanks"), "Thank you, {name}!");
});

test("every {placeholder} in a message is a simple word (so t() can fill it)", () => {
  for (const [key, value] of Object.entries(en)) {
    for (const m of value.matchAll(/\{([^}]*)\}/g)) assert.match(m[1], /^\w+$/, `${key}: ${m[0]}`);
  }
});
