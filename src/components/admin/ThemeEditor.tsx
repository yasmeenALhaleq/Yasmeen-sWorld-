"use client";

import { useActionState, useMemo, useRef, useState, type CSSProperties } from "react";
import { resetThemeAction, saveThemeAction } from "@/app/admin/_actions/settings";
import { checkImageFile, uploadImage } from "@/components/admin/uploads";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { FormAlert } from "@/components/ui/Fields";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { logoUrl } from "@/lib/images";
import {
  DEFAULT_PALETTE, extractDominantColors, generatePalette, normalizeHex, paletteToCss, paletteWarnings, readableTextOn,
  type ExtractedColor, type Palette,
} from "@/lib/palette";
import type { ActionState } from "@/lib/entity-types";

const initial: ActionState = {};

const COLOR_ROWS: { key: keyof Palette; label: string; help: string }[] = [
  { key: "primary", label: "Primary", help: "Brand colour: headings accents, links, highlights." },
  { key: "secondary", label: "Secondary", help: "Soft supporting colour for decorations." },
  { key: "accent", label: "Accent", help: "Small touches such as badges and icons." },
  { key: "background", label: "Page background", help: "The soft colour behind the pages." },
  { key: "surface", label: "Cards & white areas", help: "Cards, forms and menus." },
  { key: "text", label: "Text", help: "Body text and headings." },
  { key: "button", label: "Buttons", help: "Main buttons (Add to cart, Checkout)." },
  { key: "buttonHover", label: "Button hover", help: "Button colour when hovered or pressed." },
];

/** Reads the visible pixels of a logo file (PNG / JPG / SVG / WebP) via a small canvas. */
async function readLogoPixels(file: File): Promise<Uint8ClampedArray> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The browser could not open this image."));
      img.src = url;
    });
    // SVGs without a fixed size report 0x0; fall back to a sensible canvas.
    const w0 = img.naturalWidth || 300;
    const h0 = img.naturalHeight || 300;
    const scale = Math.min(1, 200 / Math.max(w0, h0));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Your browser cannot read image colours.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PreviewCard({ palette, logo, storeName }: { palette: Palette; logo: string | null; storeName: string }) {
  // Re-declare the theme variables on this element so the real site classes
  // (bg-primary, btn, card ...) render with the palette being edited.
  const vars = useMemo(() => {
    const css = paletteToCss(palette).replace(/^html:root\{|\}$/g, "");
    return Object.fromEntries(css.split(";").map((p) => p.split(":") as [string, string])) as CSSProperties;
  }, [palette]);

  return (
    <div style={vars} className="overflow-hidden rounded-3xl border border-ink/15 bg-page text-ink" aria-label="Live preview of the shop">
      <div className="flex items-center justify-between border-b border-primary/15 bg-surface px-4 py-3">
        {logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logo} alt={storeName} className="h-9 w-auto" />
          : <span className="font-serif text-2xl font-bold text-primary">{storeName}</span>}
        <span className="flex gap-4 text-xs font-bold"><span>Shop</span><span>Gifts</span><span className="text-primary">Cart (2)</span></span>
      </div>
      <div className="relative px-5 py-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">New collection</p>
        <p className="mt-1 font-serif text-3xl font-semibold leading-tight">Handmade with love</p>
        <p className="mx-auto mt-2 max-w-xs text-sm opacity-80">Natural body care and gifts for the people you care about.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="btn btn-primary btn-sm">Shop now</span>
          <span className="btn btn-outline btn-sm">Build a gift</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pb-5">
        {["Rose scrub", "Oat soap"].map((n, i) => (
          <div key={n} className="card overflow-hidden">
            <div className="relative aspect-[4/3]" style={{ background: i ? palette.secondary : palette.accent, opacity: 0.55 }}>
              {i === 0 && <span className="badge badge-sale absolute start-2 top-2">-20%</span>}
            </div>
            <div className="p-3">
              <p className="text-sm font-bold">{n}</p>
              <p className="text-sm"><b className="text-primary">9.500 JOD</b></p>
              <span className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: palette.button, color: readableTextOn(palette.button) }}>Add to cart</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 bg-primary/10 px-4 py-3">
        <span className="chip" aria-pressed="true">Birthday</span>
        <span className="chip">Wedding</span>
        <span className="chip">Eid</span>
      </div>
    </div>
  );
}

export function ThemeEditor({
  savedPalette, savedLogoKey, storeName,
}: { savedPalette: Palette; savedLogoKey: string; storeName: string }) {
  const [state, action] = useActionState(saveThemeAction, initial);
  const [palette, setPalette] = useState<Palette>(savedPalette);
  const [logoKey, setLogoKey] = useState(savedLogoKey);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [detected, setDetected] = useState<ExtractedColor[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);

  // When the saved theme changes on the server (after Save or "Reset"), adopt it
  // here without remounting, so the "saved" confirmation message stays visible.
  const savedSignature = `${JSON.stringify(savedPalette)}|${savedLogoKey}`;
  const [seenSignature, setSeenSignature] = useState(savedSignature);
  if (savedSignature !== seenSignature) {
    setSeenSignature(savedSignature);
    setPalette(savedPalette);
    setLogoKey(savedLogoKey);
    setRemoveLogo(false);
  }

  const currentLogo = removeLogo || !logoKey ? null : logoUrl(logoKey);
  const warnings = paletteWarnings(palette);
  const changed = JSON.stringify(palette) !== JSON.stringify(savedPalette) || logoKey !== savedLogoKey || removeLogo;

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const bad = checkImageFile(file, true);
    if (bad) { setProblem(bad); return; }
    setProblem("");
    setBusy(true);
    lastFile.current = file;
    try {
      // 1. Colours are read locally, instantly.
      const colors = extractDominantColors(await readLogoPixels(file), 6);
      setDetected(colors);
      if (colors.length === 0) setProblem("No colours were found in this logo (it may be fully transparent or white). Pick the colours manually below.");
      else setPalette(generatePalette(colors));
      // 2. The file itself is uploaded (resized, SVG made safe) so it can be saved with the palette.
      const { key } = await uploadImage(file, "logo");
      setLogoKey(key);
      setRemoveLogo(false);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The logo could not be processed.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function regenerate() {
    if (!lastFile.current) return;
    setBusy(true);
    try {
      const colors = extractDominantColors(await readLogoPixels(lastFile.current), 6);
      setDetected(colors);
      if (colors.length) setPalette(generatePalette(colors));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not read the logo.");
    } finally {
      setBusy(false);
    }
  }

  const setColor = (key: keyof Palette, value: string) => setPalette((p) => ({ ...p, [key]: value }));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form action={action} className="space-y-6 lg:col-span-3">
        <input type="hidden" name="palette" value={JSON.stringify(palette)} />
        <input type="hidden" name="logoKey" value={logoKey} />
        <input type="hidden" name="removeLogo" value={removeLogo ? "1" : "0"} />

        <section className="card card-pad space-y-4" aria-labelledby="logo-title">
          <h2 id="logo-title" className="!text-2xl">Logo</h2>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink/30 bg-surface p-2">
              {currentLogo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={currentLogo} alt="Current logo" className="max-h-full max-w-full object-contain" />
                : <span className="text-center text-xs text-ink/50">No logo yet</span>}
            </div>
            <div className="space-y-2">
              <label className="btn btn-primary btn-sm cursor-pointer" aria-disabled={busy}>
                <Icon name="upload" className="h-4 w-4" /> {busy ? "Reading logo..." : currentLogo ? "Upload a new logo" : "Upload logo"}
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" disabled={busy} onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
              {currentLogo && !busy && (
                <button type="button" className="btn btn-ghost btn-sm ms-2" onClick={() => { setRemoveLogo(true); setLogoKey(""); }}>Remove logo</button>
              )}
              <p className="help !mt-0">PNG, SVG or JPG. The colours are picked from it automatically.</p>
            </div>
          </div>
          {problem && <p className="alert alert-error" role="alert">{problem}</p>}

          {detected.length > 0 && (
            <div>
              <p className="label">Colours found in your logo</p>
              <ul className="flex flex-wrap gap-3">
                {detected.map((c) => (
                  <li key={c.hex} className="flex items-center gap-2 text-xs">
                    <span className="h-8 w-8 rounded-full border border-ink/20" style={{ background: c.hex }} />
                    <span className="font-mono">{c.hex}<br /><span className="font-sans opacity-60">{Math.round(c.share * 100)}%</span></span>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-soft btn-sm mt-3" onClick={regenerate} disabled={busy}>Generate the palette again</button>
            </div>
          )}
        </section>

        <section className="card card-pad space-y-4" aria-labelledby="pal-title">
          <div>
            <h2 id="pal-title" className="!text-2xl">Colours</h2>
            <p className="mt-1 text-sm text-ink/65">Change any colour with the picker or type a hex code. The preview updates straight away; nothing changes on the website until you save.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {COLOR_ROWS.map((row) => {
              const valid = normalizeHex(palette[row.key]);
              return (
                <li key={row.key}>
                  <label htmlFor={`c-${row.key}`} className="label">{row.label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label={`${row.label} colour picker`} value={valid ?? "#000000"}
                      onChange={(e) => setColor(row.key, e.target.value.toUpperCase())}
                      className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-ink/25 bg-surface p-1" />
                    <input id={`c-${row.key}`} value={palette[row.key]} maxLength={7} spellCheck={false}
                      onChange={(e) => { const v = e.target.value; setPalette((p) => ({ ...p, [row.key]: v })); }}
                      onBlur={(e) => { const n = normalizeHex(e.target.value); if (n) setColor(row.key, n); }}
                      aria-invalid={!valid || undefined} className="input font-mono uppercase" />
                  </div>
                  {detected.length > 0 && (
                    <div className="mt-1.5 flex gap-1" aria-label={`Use a logo colour for ${row.label}`}>
                      {detected.map((c) => (
                        <button key={c.hex} type="button" title={`Use ${c.hex}`} aria-label={`Use ${c.hex} for ${row.label}`}
                          onClick={() => setColor(row.key, c.hex)} className="h-5 w-5 rounded-full border border-ink/25" style={{ background: c.hex }} />
                      ))}
                    </div>
                  )}
                  <p className="help">{row.help}</p>
                </li>
              );
            })}
          </ul>
          {warnings.length > 0 && (
            <ul className="alert alert-error list-disc ps-8" role="status">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Saving..." className="btn btn-primary btn-lg">Save logo & colours</SubmitButton>
          <button type="button" className="btn btn-ghost" onClick={() => setPalette(savedPalette)} disabled={JSON.stringify(palette) === JSON.stringify(savedPalette)}>Undo changes</button>
          {changed && <span className="text-sm font-semibold text-amber-800">Unsaved changes</span>}
        </div>
        <FormAlert state={state} />
      </form>

      <aside className="space-y-4 lg:col-span-2">
        <div className="lg:sticky lg:top-6 space-y-4">
          <h2 className="!text-2xl">Preview</h2>
          <PreviewCard palette={palette} logo={currentLogo} storeName={storeName} />
          <form action={resetThemeAction}>
            <ConfirmButton message="Reset the colours to the Yasmeen World defaults (mauve, blush and plum)? Your logo stays." className="btn btn-outline btn-sm">
              Reset to default colours
            </ConfirmButton>
          </form>
          <p className="text-xs text-ink/60">Default palette: {DEFAULT_PALETTE.primary} primary, {DEFAULT_PALETTE.background} background, {DEFAULT_PALETTE.text} text.</p>
        </div>
      </aside>
    </div>
  );
}
