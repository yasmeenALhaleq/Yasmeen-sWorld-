import "server-only";
import { headers } from "next/headers";
import { env } from "@/server/env";

/** Best-effort client IP (behind a reverse proxy the first X-Forwarded-For entry). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip") || "local").slice(0, 64);
}

export async function getUserAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 255);
}

/**
 * CSRF defence for route handlers that change data: the browser must send an
 * Origin (or Referer) matching this site. Server Actions get an equivalent
 * check from Next.js itself.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  try {
    const sent = new URL(origin);
    const host = request.headers.get("host");
    if (host && sent.host === host) return true;
    return sent.origin === new URL(env.siteUrl).origin;
  } catch {
    return false;
  }
}
