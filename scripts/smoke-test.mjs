// Quick check that a running copy of the store behaves: pages load, the admin
// area is locked, and the server refuses tampered carts.
//
//   npm run build && npm start        (in one terminal)
//   npm run smoke                     (in another)
//
// Use SMOKE_URL to test somewhere else, e.g.  SMOKE_URL=https://shop.example.com npm run smoke
// It only reads data and never places orders.
import mysql from "mysql2/promise";
import { dbConfig } from "./env.mjs";

const BASE = (process.env.SMOKE_URL || "http://localhost:3000").replace(/\/+$/, "");
let failed = 0;
const ok = (cond, msg, detail) => {
  if (cond) console.log(`  ok    ${msg}`);
  else { failed += 1; console.log(`  FAIL  ${msg}${detail ? `  (${detail})` : ""}`); }
};

console.log(`\nSmoke test against ${BASE}\n`);

try {
  await fetch(BASE, { signal: AbortSignal.timeout(8000) });
} catch {
  console.error(`Could not reach ${BASE}. Start the store first with  npm run build && npm start`);
  process.exit(1);
}

// ---- public pages
const conn = await mysql.createConnection(dbConfig());
const [[product]] = await conn.query("SELECT id, slug, stock_quantity, track_stock FROM products WHERE is_active = 1 AND track_stock = 1 AND stock_quantity > 0 AND id NOT IN (SELECT product_id FROM product_variants) LIMIT 1")
  .catch(() => [[null]]);
const [[category]] = await conn.query("SELECT slug FROM categories WHERE is_active = 1 LIMIT 1").catch(() => [[null]]);
await conn.end();

const pages = ["/", "/shop", "/gifts", "/gifts/build", "/cart", "/checkout", "/robots.txt", "/sitemap.xml"];
if (category) pages.push(`/category/${category.slug}`);
if (product) pages.push(`/product/${product.slug}`);
for (const p of pages) {
  const res = await fetch(BASE + p, { redirect: "manual" });
  ok(res.status === 200, `GET ${p} -> 200`, res.status);
}
ok((await fetch(`${BASE}/definitely-not-a-page`)).status === 404, "unknown pages return 404");
ok((await fetch(`${BASE}/product/definitely-not-a-product`)).status === 404, "unknown products return 404");

// ---- admin is locked
for (const p of ["/admin", "/admin/products", "/admin/orders", "/admin/settings"]) {
  const res = await fetch(BASE + p, { redirect: "manual" });
  ok(res.status === 307 && (res.headers.get("location") || "").includes("/admin/login"), `GET ${p} redirects to the login page`, res.status);
}
ok((await fetch(`${BASE}/admin/login`)).status === 200, "the login page loads");
ok((await fetch(`${BASE}/api/admin/upload`, { method: "POST", body: new FormData() })).status === 401, "uploads are refused without signing in");
const headers = (await fetch(`${BASE}/admin/login`)).headers;
ok(headers.get("x-content-type-options") === "nosniff" && Boolean(headers.get("x-frame-options")), "security headers are present");

// ---- the server prices carts itself
if (product) {
  const quote = async (lines, extra = {}) => (await fetch(`${BASE}/api/cart/quote`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, ...extra }),
  }));
  let res = await quote([{ id: "a", kind: "product", productId: product.id, variantId: null, qty: 1, price: 0.001 }]);
  const data = await res.json();
  ok(res.status === 200 && data.lines[0].unitPrice > 0.001, "a price sent by the browser is ignored", data.lines?.[0]?.unitPrice);
  res = await quote([{ id: "a", kind: "product", productId: product.id, variantId: null, qty: product.stock_quantity + 5 }]);
  const over = await res.json();
  ok(over.canCheckout === false, "asking for more than the stock blocks checkout");
  res = await quote([{ id: "a", kind: "product", productId: "x", qty: -1 }]);
  ok(res.status === 400, "a malformed cart is rejected");
}

console.log(failed ? `\n${failed} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failed ? 1 : 0);
