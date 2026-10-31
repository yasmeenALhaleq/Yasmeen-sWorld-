import "server-only";

// In-memory sliding-window limiter for public endpoints (checkout, coupon
// check). Good enough to stop casual abuse on a single server. Admin login
// uses the database-backed limiter in services/admin-auth.ts instead.

const g = globalThis as unknown as { __bwHits?: Map<string, number[]> };
const hits = (g.__bwHits ??= new Map<string, number[]>());

/** Returns true if the action is allowed, false if the limit is exceeded. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    // Opportunistic cleanup so the map cannot grow without bound.
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}
