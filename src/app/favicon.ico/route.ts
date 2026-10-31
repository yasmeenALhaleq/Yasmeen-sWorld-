import { NextResponse } from "next/server";
import { getSettings } from "@/server/services/settings";
import { iconUrl } from "@/lib/images";

// Depends on the saved logo, so it must be evaluated per request (not at build time).
export const dynamic = "force-dynamic";

// Browsers ask for /favicon.ico on their own. Send them the uploaded logo icon
// when there is one, otherwise a small blossom in the brand colour.
export async function GET(request: Request) {
  const settings = await getSettings();
  if (settings.logoKey) return NextResponse.redirect(new URL(iconUrl(settings.logoKey), request.url), 307);

  const color = settings.theme.primary;
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="32" cy="16" rx="9" ry="15" fill="${color}" transform="rotate(${a} 32 32)"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${petals}<circle cx="32" cy="32" r="7" fill="#fff"/></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
}
