import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PALETTE, contrastRatio, extractDominantColors, generatePalette, hexToRgb, hslToHex,
  hexToHsl, normalizeHex, paletteToCss, paletteWarnings, rgbToHex,
} from "../../src/lib/palette.ts";

/** Builds RGBA pixel data from [hex, count] pairs. */
function pixelsOf(parts: [string | null, number][]): Uint8ClampedArray {
  const total = parts.reduce((s, [, n]) => s + n, 0);
  const out = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [hex, n] of parts) {
    for (let k = 0; k < n; k++) {
      if (hex === null) { out.set([0, 0, 0, 0], i); } // fully transparent
      else { const c = hexToRgb(hex); out.set([c.r, c.g, c.b, 255], i); }
      i += 4;
    }
  }
  return out;
}

test("hex <-> rgb <-> hsl round trips", () => {
  assert.equal(rgbToHex(hexToRgb("#9B5478")), "#9B5478");
  assert.equal(normalizeHex("abc"), "#AABBCC");
  assert.equal(normalizeHex("#12345"), null);
  const hsl = hexToHsl("#9B5478");
  assert.ok(Math.abs(hexToRgb(hslToHex(hsl)).r - 155) <= 1);
});

test("contrast ratio matches known WCAG values", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#FFFFFF") - 21) < 0.01);
  assert.ok(contrastRatio("#9B5478", "#FFFFFF") > 5);
});

test("the default palette passes its own accessibility checks", () => {
  assert.deepEqual(DEFAULT_PALETTE, {
    primary: "#9B5275",
    secondary: "#D8B8C7",
    accent: "#EAD8E0",
    background: "#FAF6F8",
    surface: "#F3E8ED",
    text: "#352A2B",
    button: "#9B5275",
    buttonHover: "#9B5275",
  });
  assert.deepEqual(paletteWarnings(DEFAULT_PALETTE), []);
});

test("extraction ignores transparent and white pixels and ranks by share", () => {
  const colors = extractDominantColors(pixelsOf([
    [null, 5000], ["#FFFFFF", 5000], ["#2E7D5B", 3000], ["#E4A0B7", 1000],
  ]));
  assert.equal(colors.length, 2);
  assert.ok(contrastRatio(colors[0].hex, "#2E7D5B") < 1.1, `dominant colour was ${colors[0].hex}`);
  assert.ok(colors[0].share > colors[1].share);
  assert.ok(Math.abs(colors[0].share + colors[1].share - 1) < 1e-9);
});

test("near-identical shades are merged into one colour", () => {
  const colors = extractDominantColors(pixelsOf([["#2E7D5B", 500], ["#2F7E5C", 500], ["#2D7C5A", 500]]));
  assert.equal(colors.length, 1);
});

test("an empty (all transparent) logo gives no colours and the default palette", () => {
  assert.deepEqual(extractDominantColors(pixelsOf([[null, 100]])), []);
  assert.deepEqual(generatePalette([]), DEFAULT_PALETTE);
});

test("generated palette is complete, readable and follows the logo hue", () => {
  const logo = extractDominantColors(pixelsOf([
    ["#2E7D5B", 6000], ["#E4A0B7", 2500], ["#C9A24A", 1500],
  ]));
  const p = generatePalette(logo);

  for (const key of ["primary", "secondary", "accent", "background", "surface", "text", "button", "buttonHover"] as const) {
    assert.match(p[key], /^#[0-9A-F]{6}$/, key);
  }
  // Primary keeps the green hue of the dominant colour.
  assert.ok(Math.abs(hexToHsl(p.primary).h - hexToHsl("#2E7D5B").h) < 10);
  // Background is a light tint, text is dark, and both stay readable.
  assert.ok(hexToHsl(p.background).l > 0.9);
  assert.ok(hexToHsl(p.text).l < 0.3);
  assert.deepEqual(paletteWarnings(p), []);
  assert.ok(contrastRatio(p.button, "#FFFFFF") >= 4.5);
  // Hover is visibly darker than the button.
  assert.ok(hexToHsl(p.buttonHover).l < hexToHsl(p.button).l);
});

test("a pastel logo still produces accessible buttons", () => {
  const p = generatePalette(extractDominantColors(pixelsOf([["#F4C2D7", 4000], ["#CFE8D5", 1000]])));
  assert.ok(contrastRatio(p.button, "#FFFFFF") >= 4.5);
  assert.deepEqual(paletteWarnings(p), []);
});

test("a single-colour logo still gets a secondary and accent colour", () => {
  const p = generatePalette(extractDominantColors(pixelsOf([["#7A3E65", 4000]])));
  assert.notEqual(p.secondary, p.primary);
  assert.notEqual(p.accent, p.primary);
});

test("palette CSS exposes every variable", () => {
  const css = paletteToCss(DEFAULT_PALETTE);
  for (const v of ["--bw-primary", "--bw-secondary", "--bw-accent", "--bw-bg", "--bw-surface", "--bw-text", "--bw-button", "--bw-button-hover", "--bw-button-text"]) {
    assert.ok(css.includes(v), v);
  }
});
