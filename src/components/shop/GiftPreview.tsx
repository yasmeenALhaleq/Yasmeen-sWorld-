import { useId } from "react";
import { hexToHsl, hslToHex } from "@/lib/palette";
import { imageUrl } from "@/lib/images";
import { t } from "@/i18n";
import type { GiftBaseType, ImageRef } from "@/lib/types";

// Live illustration of the gift being built: the chosen base, wrapping and
// ribbon, with one slot per product the base can hold. Filled slots show the
// product picture; empty ones are dashed so customers can see the capacity.

const shade = (hex: string, delta: number) => {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: Math.min(0.95, Math.max(0.08, hsl.l + delta)) });
};

interface Slot { x: number; y: number; r: number }

/** Rows x columns grid of round slots inside a rectangle. */
function gridSlots(n: number, x0: number, x1: number, y0: number, y1: number): Slot[] {
  if (n <= 0) return [];
  const cols = n <= 3 ? n : n <= 8 ? Math.ceil(n / 2) : Math.ceil(n / 3);
  const rows = Math.ceil(n / cols);
  const r = Math.min((x1 - x0) / cols / 2, (y1 - y0) / rows / 2, 34) - 2;
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = i - row * cols;
    const cx = (x0 + x1) / 2 + (col - (inRow - 1) / 2) * (r * 2 + 6);
    slots.push({ x: cx, y: y0 + r + row * (r * 2 + 6), r });
  }
  return slots;
}

/** Inverted triangle (a bunch of grapes): widest row on top. */
function clusterSlots(n: number, cx: number, y0: number, width: number): Slot[] {
  if (n <= 0) return [];
  let rows = 1;
  while ((rows * (rows + 1)) / 2 < n) rows++;
  const r = Math.min(width / rows / 2, 30) - 2;
  const slots: Slot[] = [];
  let placed = 0;
  for (let row = 0; row < rows && placed < n; row++) {
    const inRow = rows - row;
    for (let col = 0; col < inRow && placed < n; col++, placed++) {
      slots.push({ x: cx + (col - (inRow - 1) / 2) * (r * 2 + 4), y: y0 + r + row * (r * 1.8 + 3), r });
    }
  }
  return slots;
}

function Bow({ x, y, color, scale = 1 }: { x: number; y: number; color: string; scale?: number }) {
  const dark = shade(color, -0.12);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-4 6 L-20 38 L-9 33 L-3 42 Z" fill={dark} />
      <path d="M4 6 L20 38 L9 33 L3 42 Z" fill={dark} />
      <ellipse cx="-17" cy="-2" rx="19" ry="11" transform="rotate(-18 -17 -2)" fill={color} />
      <ellipse cx="17" cy="-2" rx="19" ry="11" transform="rotate(18 17 -2)" fill={color} />
      <circle r="7" fill={dark} />
    </g>
  );
}

export function GiftPreview({
  type, ribbonColor, wrappingColor, capacity, images, className = "",
}: {
  type: GiftBaseType | null;
  ribbonColor: string | null;
  wrappingColor: string | null;
  capacity: number;
  /** One entry per selected unit (so 2 x soap = two entries). */
  images: (ImageRef | null)[];
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const kind = type ?? "box";
  const wrap = wrappingColor ?? (kind === "basket" ? "#C9A56B" : kind === "bouquet" ? "#F3D6E3" : "#E8D9C5");
  const wrapDark = shade(wrap, -0.1);
  const slotCount = Math.max(capacity, images.length, type ? 0 : 4);

  const slots =
    kind === "grape" ? clusterSlots(slotCount, 160, 62, 210)
    : kind === "bouquet" ? gridSlots(slotCount, 80, 240, 34, 140)
    : gridSlots(slotCount, 62, 258, 22, 132);

  const items = slots.map((s, i) => ({ ...s, image: images[i] ?? null, index: i }));

  return (
    <svg viewBox="0 0 320 300" role="img" aria-label={t("builder.previewLabel", { count: images.length, max: capacity })} className={`w-full ${className}`}>
      <defs>
        {items.map((s) => (
          <clipPath id={`${uid}-c${s.index}`} key={s.index}><circle cx={s.x} cy={s.y} r={s.r} /></clipPath>
        ))}
        <pattern id={`${uid}-wicker`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 7h14M7 0v14" stroke={shade(wrap, -0.14)} strokeWidth="2" opacity="0.55" />
        </pattern>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="160" cy="276" rx="105" ry="10" fill="currentColor" opacity="0.1" />

      {/* ---- back of the container ---- */}
      {kind === "box" && <rect x="42" y="130" width="236" height="116" rx="12" fill={wrapDark} />}
      {kind === "basket" && (
        <>
          <path d="M70 124 C70 34 250 34 250 124" fill="none" stroke={shade(wrap, -0.18)} strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="160" cy="128" rx="116" ry="16" fill={shade(wrap, -0.18)} />
        </>
      )}
      {kind === "bouquet" && (
        <g fill="#D8B8C7" opacity="0.85">
          <path d="M120 70 C70 50 60 20 70 8 C100 20 118 44 120 70Z" />
          <path d="M200 70 C250 50 260 20 250 8 C220 20 202 44 200 70Z" />
          <path d="M160 70 C150 40 160 16 160 4 C172 16 172 44 160 70Z" />
        </g>
      )}
      {kind === "grape" && (
        <g>
          <path d="M160 70 C158 40 166 24 176 14" fill="none" stroke="#D8B8C7" strokeWidth="5" strokeLinecap="round" />
          <path d="M170 28 C196 8 226 14 232 36 C204 44 182 40 170 28Z" fill="#D8B8C7" opacity="0.9" />
          <path d="M160 52 C132 38 108 46 104 66 C130 74 150 68 160 52Z" fill="#D8B8C7" opacity="0.75" />
        </g>
      )}

      {/* ---- product slots ---- */}
      {items.map((s) => (
        <g key={s.index}>
          {s.image ? (
            <>
              <circle cx={s.x} cy={s.y} r={s.r + 2} fill="#fff" />
              <image href={imageUrl(s.image.key, 400)} x={s.x - s.r} y={s.y - s.r} width={s.r * 2} height={s.r * 2}
                preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}-c${s.index})`} />
            </>
          ) : (
            <circle cx={s.x} cy={s.y} r={s.r} fill="#fff" fillOpacity="0.35" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 5" />
          )}
        </g>
      ))}

      {/* ---- front of the container (hides the lower part of the products) ---- */}
      {kind === "box" && (
        <>
          <rect x="34" y="150" width="252" height="106" rx="14" fill={wrap} />
          <rect x="28" y="132" width="264" height="30" rx="10" fill={shade(wrap, 0.05)} />
          {ribbonColor && <rect x="146" y="132" width="28" height="124" fill={ribbonColor} />}
                  </>
      )}
      {kind === "basket" && (
        <>
          <path d="M44 136 H276 L252 260 Q250 270 240 270 H80 Q70 270 68 260 Z" fill={wrap} />
          <path d="M44 136 H276 L252 260 Q250 270 240 270 H80 Q70 270 68 260 Z" fill={`url(#${uid}-wicker)`} />
          <rect x="40" y="128" width="240" height="16" rx="8" fill={shade(wrap, -0.08)} />
        </>
      )}
      {kind === "bouquet" && (
        <>
          <path d="M62 120 H258 L176 270 Q160 282 144 270 Z" fill={wrap} fillOpacity="0.96" />
          <path d="M62 120 H258 L214 200 H106 Z" fill="#fff" fillOpacity="0.18" />
          <path d="M160 130 L146 270" stroke={wrapDark} strokeWidth="2" opacity="0.4" />
          <path d="M160 130 L176 268" stroke={wrapDark} strokeWidth="2" opacity="0.4" />
        </>
      )}

      {/* ---- ribbon ---- */}
      {ribbonColor && kind === "box" && <Bow x={160} y={134} color={ribbonColor} />}
      {ribbonColor && kind === "basket" && <Bow x={160} y={138} color={ribbonColor} scale={1.05} />}
      {ribbonColor && kind === "bouquet" && (
        <>
          <path d="M104 190 Q160 206 216 190 L212 204 Q160 220 108 204 Z" fill={ribbonColor} />
          <Bow x={160} y={200} color={ribbonColor} scale={0.9} />
        </>
      )}
      {ribbonColor && kind === "grape" && <Bow x={160} y={64} color={ribbonColor} scale={0.9} />}
    </svg>
  );
}
