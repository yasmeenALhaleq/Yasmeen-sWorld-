import "server-only";

// Tiny in-process TTL cache for data that is read on almost every page view
// (settings, navigation, the product catalogue). Admin writes call
// clearCache() so the owner sees changes immediately; other server instances
// would catch up within the TTL.
//
// Parked on globalThis so it survives hot reloads in `next dev`.

interface Entry { value: unknown; expires: number }
const g = globalThis as unknown as { __bwCache?: Map<string, Entry>; __bwInflight?: Map<string, Promise<unknown>> };
const store = (g.__bwCache ??= new Map<string, Entry>());
const inflight = (g.__bwInflight ??= new Map<string, Promise<unknown>>());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  // Collapse concurrent misses into a single database round trip.
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Drops cached entries whose key starts with `prefix` (everything when omitted). */
export function clearCache(prefix = ""): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
