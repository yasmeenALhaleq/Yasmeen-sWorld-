// Brand palette: colour maths, dominant-colour extraction from logo pixels and
// automatic palette generation. Pure functions (no DOM) so they run both in the
// admin browser (canvas pixels) and in unit tests.

export interface Rgb { r: number; g: number; b: number }
export interface Hsl { h: number; s: number; l: number } // h: 0-360, s/l: 0-1

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  button: string;
  buttonHover: string;
}

export const PALETTE_KEYS = [
  "primary", "secondary", "accent", "background", "surface", "text", "button", "buttonHover",
] as const satisfies readonly (keyof Palette)[];

/** Brand defaults used until a logo is uploaded (or after "Reset"). */
export const DEFAULT_PALETTE: Palette = {
  primary: "#9B5275",
  secondary: "#D8B8C7",
  accent: "#EAD8E0",
  background: "#FAF6F8",
  surface: "#F3E8ED",
  text: "#352A2B",
  button: "#9B5275",
  buttonHover: "#9B5275",
};

// ------------------------------------------------------------------ basics

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function normalizeHex(input: string): string | null {
  const m = input.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const n = normalizeHex(hex) ?? "#000000";
  return { r: parseInt(n.slice(1, 3), 16), g: parseInt(n.slice(3, 5), 16), b: parseInt(n.slice(5, 7), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export const hslToHex = (hsl: Hsl) => rgbToHex(hslToRgb(hsl));
export const hexToHsl = (hex: string) => rgbToHsl(hexToRgb(hex));

export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colours (1 - 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black text, whichever reads better on `background`. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#1F1018") ? "#FFFFFF" : "#1F1018";
}

/** Darkens (or lightens) a colour until it reaches `minRatio` against `against`. */
function ensureContrast(hex: string, against: string, minRatio: number, direction: "darker" | "lighter"): string {
  let hsl = hexToHsl(hex);
  for (let i = 0; i < 60 && contrastRatio(hslToHex(hsl), against) < minRatio; i++) {
    hsl = { ...hsl, l: clamp(hsl.l + (direction === "darker" ? -0.01 : 0.01), 0, 1) };
  }
  return hslToHex(hsl);
}

// -------------------------------------------------------------- extraction

export interface ExtractedColor {
  hex: string;
  /** Share of the logo's visible pixels (0-1). */
  share: number;
}

interface Bucket { r: number; g: number; b: number; n: number }

/**
 * Finds the dominant colours in RGBA pixel data (as returned by
 * canvas.getImageData). Transparent pixels and the white/near-white
 * background are ignored. Uses a 4-bit histogram followed by median-cut.
 */
export function extractDominantColors(
  pixels: ArrayLike<number>,
  maxColors = 6,
  options: { ignoreWhite?: boolean } = {},
): ExtractedColor[] {
  const ignoreWhite = options.ignoreWhite ?? true;
  const bins = new Map<number, Bucket>();
  let total = 0;

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue; // transparent
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (ignoreWhite && r > 242 && g > 242 && b > 242) continue; // paper white
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key);
    if (bin) { bin.r += r; bin.g += g; bin.b += b; bin.n += 1; }
    else bins.set(key, { r, g, b, n: 1 });
    total += 1;
  }
  if (total === 0) return [];

  // Median cut over the histogram buckets.
  type Box = { items: Bucket[]; n: number };
  const items = [...bins.values()].map((x) => ({ r: x.r / x.n, g: x.g / x.n, b: x.b / x.n, n: x.n }));
  const boxes: Box[] = [{ items, n: total }];

  const range = (box: Box) => {
    let [rMin, gMin, bMin, rMax, gMax, bMax] = [255, 255, 255, 0, 0, 0];
    for (const it of box.items) {
      rMin = Math.min(rMin, it.r); rMax = Math.max(rMax, it.r);
      gMin = Math.min(gMin, it.g); gMax = Math.max(gMax, it.g);
      bMin = Math.min(bMin, it.b); bMax = Math.max(bMax, it.b);
    }
    return { r: rMax - rMin, g: gMax - gMin, b: bMax - bMin };
  };

  while (boxes.length < Math.max(maxColors * 2, 8)) {
    // Split the box with the most visual spread * population.
    let bestIdx = -1, bestScore = 0;
    boxes.forEach((box, idx) => {
      if (box.items.length < 2) return;
      const rg = range(box);
      const score = Math.max(rg.r, rg.g, rg.b) * Math.sqrt(box.n);
      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    });
    if (bestIdx === -1) break;
    const box = boxes[bestIdx];
    const rg = range(box);
    const channel: "r" | "g" | "b" = rg.r >= rg.g && rg.r >= rg.b ? "r" : rg.g >= rg.b ? "g" : "b";
    const sorted = [...box.items].sort((x, y) => x[channel] - y[channel]);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length; i++) {
      acc += sorted[i].n;
      if (acc >= box.n / 2) { cut = clamp(i + 1, 1, sorted.length - 1); break; }
    }
    const left = sorted.slice(0, cut), right = sorted.slice(cut);
    boxes.splice(bestIdx, 1,
      { items: left, n: left.reduce((s, x) => s + x.n, 0) },
      { items: right, n: right.reduce((s, x) => s + x.n, 0) });
  }

  // Average each box, then merge colours that are visually the same.
  const merged: { rgb: Rgb; n: number }[] = [];
  const sortedBoxes = boxes.sort((a, b) => b.n - a.n);
  for (const box of sortedBoxes) {
    const n = box.n;
    const rgb = {
      r: box.items.reduce((s, x) => s + x.r * x.n, 0) / n,
      g: box.items.reduce((s, x) => s + x.g * x.n, 0) / n,
      b: box.items.reduce((s, x) => s + x.b * x.n, 0) / n,
    };
    const near = merged.find((m) => Math.hypot(m.rgb.r - rgb.r, m.rgb.g - rgb.g, m.rgb.b - rgb.b) < 40);
    if (near) {
      const sum = near.n + n;
      near.rgb = {
        r: (near.rgb.r * near.n + rgb.r * n) / sum,
        g: (near.rgb.g * near.n + rgb.g * n) / sum,
        b: (near.rgb.b * near.n + rgb.b * n) / sum,
      };
      near.n = sum;
    } else merged.push({ rgb, n });
  }

  return merged
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors)
    .map((m) => ({ hex: rgbToHex(m.rgb), share: m.n / total }));
}

// -------------------------------------------------------------- generation

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Builds a full site palette from the logo's dominant colours:
 *  - primary:    the most prominent *colourful* colour
 *  - secondary:  the next clearly different colour (or a soft tint of primary)
 *  - accent:     a third colour (or a muted complementary tone)
 *  - background: a very light tint of the primary hue
 *  - text:       a very dark shade of the primary hue
 *  - button:     the primary, darkened only if white text would be hard to read
 */
export function generatePalette(colors: ExtractedColor[]): Palette {
  if (colors.length === 0) return { ...DEFAULT_PALETTE };

  const hsls = colors.map((c) => ({ ...c, hsl: hexToHsl(c.hex) }));
  const colourful = hsls.filter((c) => c.hsl.s >= 0.18 && c.hsl.l > 0.1 && c.hsl.l < 0.92);
  const pool = colourful.length > 0 ? colourful : hsls;

  // Prominence, nudged toward more saturated colours.
  const primaryCandidate = [...pool].sort((a, b) => b.share * (0.4 + b.hsl.s) - a.share * (0.4 + a.hsl.s))[0];
  const ph = primaryCandidate.hsl;
  const primaryHsl: Hsl = { h: ph.h, s: clamp(ph.s, 0, 0.85), l: clamp(ph.l, 0.22, 0.72) };
  const primary = hslToHex(primaryHsl);

  const others = hsls.filter((c) => c !== primaryCandidate);
  const secondaryCandidate = others.find(
    (c) => hueDistance(c.hsl.h, ph.h) > 25 || Math.abs(c.hsl.l - ph.l) > 0.25,
  );
  const secondary = secondaryCandidate
    ? hslToHex({ h: secondaryCandidate.hsl.h, s: clamp(secondaryCandidate.hsl.s, 0.15, 0.8), l: clamp(secondaryCandidate.hsl.l, 0.3, 0.8) })
    : hslToHex({ h: ph.h, s: clamp(primaryHsl.s * 0.7, 0.15, 0.6), l: 0.76 });

  const accentCandidate = others.find(
    (c) => c !== secondaryCandidate && (hueDistance(c.hsl.h, ph.h) > 25 || Math.abs(c.hsl.l - ph.l) > 0.25),
  );
  const accent = accentCandidate
    ? hslToHex({ h: accentCandidate.hsl.h, s: clamp(accentCandidate.hsl.s, 0.15, 0.8), l: clamp(accentCandidate.hsl.l, 0.3, 0.7) })
    : hslToHex({ h: (ph.h + 150) % 360, s: 0.22, l: 0.56 }); // muted complementary

  const surface = "#FFFFFF";
  const background = hslToHex({ h: ph.h, s: clamp(ph.s * 0.6, 0.12, 0.45), l: 0.94 });
  const text = ensureContrast(
    hslToHex({ h: ph.h, s: clamp(ph.s * 0.5, 0.1, 0.4), l: 0.2 }),
    background, 8, "darker",
  );
  const button = ensureContrast(primary, "#FFFFFF", 4.5, "darker");
  const buttonHover = hslToHex({ ...hexToHsl(button), l: clamp(hexToHsl(button).l - 0.08, 0.05, 0.9) });

  return { primary, secondary, accent, background, surface, text, button, buttonHover };
}

/** Quick accessibility report shown next to the palette preview. */
export function paletteWarnings(p: Palette): string[] {
  const out: string[] = [];
  if (contrastRatio(p.text, p.background) < 4.5) out.push("Body text is hard to read on the page background.");
  if (contrastRatio(p.text, p.surface) < 4.5) out.push("Body text is hard to read on white cards.");
  if (contrastRatio(p.button, readableTextOn(p.button)) < 4.5) out.push("Button text is hard to read on the button colour.");
  return out;
}

/** CSS custom properties injected into <html> (server-side, so there is no colour flash). */
export function paletteToCss(p: Palette): string {
  const vars: Record<string, string> = {
    "--bw-primary": p.primary,
    "--bw-secondary": p.secondary,
    "--bw-accent": p.accent,
    "--bw-bg": p.background,
    "--bw-surface": p.surface,
    "--bw-text": p.text,
    "--bw-button": p.button,
    "--bw-button-hover": p.buttonHover,
    "--bw-button-text": readableTextOn(p.button),
    "--bw-primary-text": readableTextOn(p.primary),
  };
  // `html:root` out-ranks the plain `:root` defaults in globals.css.
  return `html:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
}
