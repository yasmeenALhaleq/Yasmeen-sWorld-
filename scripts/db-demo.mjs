// Fills the shop with SAMPLE content so you can see how the store looks:
// products (with generated pictures), banners, testimonials, a sample
// discount and a sample coupon. Everything is flagged as sample data and can
// be removed again without touching anything you added yourself.
//
//   npm run db:demo           add the sample content
//   npm run db:demo:remove    remove it again (before you launch!)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { dbConfig, uploadDir } from "./env.mjs";

const remove = process.argv.includes("--remove");
const conn = await mysql.createConnection({ ...dbConfig(), charset: "utf8mb4" });
await conn.query("SET time_zone = '+00:00'");
const dir = uploadDir();
fs.mkdirSync(dir, { recursive: true });

// ----------------------------------------------------------------------------
// Removal
// ----------------------------------------------------------------------------
async function referencedKeys() {
  const used = new Set();
  for (const sql of [
    "SELECT image_key k FROM product_images", "SELECT image_key k FROM order_items", "SELECT image_key k FROM banners",
    "SELECT image_key k FROM categories", "SELECT image_key k FROM occasions", "SELECT image_key k FROM gift_bases",
    "SELECT image_key k FROM gift_options", "SELECT setting_value k FROM settings WHERE setting_key = 'logo_key'",
  ]) {
    const [rows] = await conn.query(sql);
    rows.forEach((r) => r.k && used.add(r.k));
  }
  return used;
}

if (remove) {
  const [imgs] = await conn.query(
    "SELECT image_key k FROM product_images WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1) UNION SELECT image_key FROM banners WHERE is_demo = 1 AND image_key IS NOT NULL");
  const keys = imgs.map((r) => r.k);

  const [p] = await conn.query("DELETE FROM products WHERE is_demo = 1");
  const [b] = await conn.query("DELETE FROM banners WHERE is_demo = 1");
  const [t] = await conn.query("DELETE FROM testimonials WHERE is_demo = 1");
  const [d] = await conn.query("DELETE FROM discounts WHERE name LIKE 'Sample:%'");
  const [c] = await conn.query("DELETE FROM coupons WHERE code = 'SAMPLE10'");

  const used = await referencedKeys();
  let files = 0;
  for (const key of new Set(keys)) {
    if (used.has(key)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.startsWith(`${key}-`))) { fs.rmSync(path.join(dir, f), { force: true }); files += 1; }
  }
  console.log(`Removed ${p.affectedRows} products, ${b.affectedRows} banners, ${t.affectedRows} testimonials, ${d.affectedRows} discounts, ${c.affectedRows} coupons and ${files} picture files.`);
  console.log("Orders that included sample products keep their record of them.");
  await conn.end();
  process.exit(0);
}

const [[{ n: existing }]] = await conn.query("SELECT COUNT(*) AS n FROM products WHERE is_demo = 1");
if (existing > 0) {
  console.log(`Sample content is already present (${existing} sample products). Run  npm run db:demo:remove  first to start over.`);
  await conn.end();
  process.exit(0);
}

// ----------------------------------------------------------------------------
// Picture generator: soft botanical illustrations (no external images needed)
// ----------------------------------------------------------------------------
const PALETTES = {
  lavender: { bg: ["#EFE6F7", "#CDB6E6"], accent: "#7A5BA6" },
  rose: { bg: ["#FCE8EE", "#F2B8CA"], accent: "#C0527A" },
  jasmine: { bg: ["#FFF8E3", "#F6E3A6"], accent: "#A9892C" },
  vanilla: { bg: ["#FFF3E2", "#F2D9B3"], accent: "#B4803F" },
  citrus: { bg: ["#FFF2D6", "#FFCF8A"], accent: "#D9822B" },
  mint: { bg: ["#E6F6EE", "#A9DCC1"], accent: "#3E8F6A" },
  coconut: { bg: ["#F7F2EC", "#E3D7C8"], accent: "#8A6D4F" },
  plum: { bg: ["#F8ECF2", "#E7C2D4"], accent: "#9B5478" },
};

const blossom = (cx, cy, r, color, centre = "#fff6d8") =>
  `<g transform="translate(${cx} ${cy})">${[0, 72, 144, 216, 288].map((a) =>
    `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.36}" ry="${r * 0.6}" fill="${color}" transform="rotate(${a})"/>`).join("")}<circle r="${r * 0.2}" fill="${centre}"/></g>`;
const leaf = (x, y, rot, s, color) => `<path d="M0 0C30-26 90-26 120 0 90 26 30 26 0 0Z" fill="${color}" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"/>`;
const sprig = (x, y, rot, s, color, op = 0.4) =>
  `<g opacity="${op}" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C-6 -140 6 -300 0 -420" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
  [60, 130, 200, 270, 340].map((d, i) => leaf(0, -d, i % 2 ? -25 : -155, 0.8 - i * 0.07, color)).join("") + `</g>`;

function product(kind, p, variant) {
  const a = p.accent, light = p.bg[0], mid = p.bg[1];
  const v2 = variant === 2;
  const scale = v2 ? 1.05 : 1.3;
  const ty = v2 ? 120 : 0;
  let body = "";
  if (kind === "jar") {
    body = `<g transform="translate(600 ${860 + ty}) scale(${scale})">
      <ellipse cx="0" cy="330" rx="250" ry="34" fill="#000" opacity=".1"/>
      <rect x="-230" y="-60" width="460" height="380" rx="70" fill="#fffaf6"/>
      <rect x="-230" y="-60" width="460" height="380" rx="70" fill="${mid}" opacity=".45"/>
      <rect x="-250" y="-190" width="500" height="150" rx="38" fill="${a}"/>
      <rect x="-250" y="-72" width="500" height="26" fill="#000" opacity=".12"/>
      <rect x="-165" y="40" width="330" height="190" rx="22" fill="#fff" opacity=".9"/>
      ${blossom(0, 105, 70, a)}
      <rect x="-110" y="170" width="220" height="12" rx="6" fill="${a}" opacity=".6"/>
      <rect x="-70" y="196" width="140" height="10" rx="5" fill="${a}" opacity=".35"/></g>`;
  } else if (kind === "bottle") {
    body = `<g transform="translate(600 ${850 + ty}) scale(${scale})">
      <ellipse cx="0" cy="360" rx="190" ry="30" fill="#000" opacity=".1"/>
      <rect x="-50" y="-330" width="100" height="90" rx="14" fill="#a9825a"/>
      <rect x="-70" y="-250" width="140" height="70" rx="12" fill="${a}"/>
      <path d="M-150 -170 H150 Q190 -170 190 -120 V310 Q190 360 140 360 H-140 Q-190 360 -190 310 V-120 Q-190 -170 -150 -170Z" fill="#fffaf6"/>
      <path d="M-150 -170 H150 Q190 -170 190 -120 V310 Q190 360 140 360 H-140 Q-190 360 -190 310 V-120 Q-190 -170 -150 -170Z" fill="${mid}" opacity=".55"/>
      <rect x="-130" y="-20" width="260" height="260" rx="26" fill="#fff" opacity=".9"/>
      ${blossom(0, 85, 76, a)}
      <rect x="-90" y="170" width="180" height="12" rx="6" fill="${a}" opacity=".55"/></g>`;
  } else if (kind === "soap") {
    const bar = (x, y, rot, c) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})"><rect x="-210" y="-120" width="420" height="240" rx="52" fill="${c}"/>
      <rect x="-210" y="-120" width="420" height="240" rx="52" fill="url(#shine)"/><rect x="-150" y="-55" width="300" height="110" rx="26" fill="#fff" opacity=".35"/>${blossom(0, 0, 54, a, "#fff")}</g>`;
    body = `<defs><linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient></defs>
      <ellipse cx="600" cy="${1060 + ty}" rx="330" ry="34" fill="#000" opacity=".1"/>
      ${bar(560, 980 + ty, -5, mid)}${bar(640, 800 + ty, 6, light)}${bar(590, 640 + ty, -3, mid)}`;
  } else if (kind === "grape") {
    const rows = [6, 5, 4, 3, 2, 1];
    let circles = "";
    rows.forEach((n, ri) => {
      for (let i = 0; i < n; i++) {
        const x = 600 + (i - (n - 1) / 2) * 112, y = 620 + ri * 98 + ty;
        circles += `<circle cx="${x}" cy="${y}" r="62" fill="${i % 2 ? a : mid}" /><circle cx="${x - 18}" cy="${y - 20}" r="16" fill="#fff" opacity=".45"/>`;
      }
    });
    body = `<g transform="scale(1)"><path d="M600 640 C596 520 640 450 700 410" stroke="#6f8f78" stroke-width="14" fill="none" stroke-linecap="round" transform="translate(0 ${ty - 40})"/>
      ${leaf(690, 410 + ty - 40, -30, 1.4, "#7E9C86")}${leaf(560, 540 + ty, -165, 1.1, "#7E9C86")}${circles}</g>`;
  } else if (kind === "bouquet") {
    const cols = [a, mid, "#fff", light, a, mid, "#fff"];
    const pos = [[600, 470], [470, 540], [730, 540], [540, 640], [670, 640], [420, 670], [780, 670]];
    body = `<g transform="translate(0 ${ty})">${pos.map(([x, y], i) => `<path d="M${x} ${y} Q${(x + 600) / 2} ${y + 180} 600 940" stroke="#6f8f78" stroke-width="10" fill="none"/>`).join("")}
      ${leaf(470, 740, -150, 1.2, "#7E9C86")}${leaf(730, 740, -30, 1.2, "#7E9C86")}${leaf(600, 700, -95, 1.0, "#6f8f78")}
      ${pos.map(([x, y], i) => blossom(x, y, 96 - i * 4, cols[i], i % 2 ? "#ffe9a8" : "#fff2c4")).join("")}
      <path d="M360 840 L840 840 L650 1300 Q600 1330 550 1300 Z" fill="#fff" opacity=".92"/>
      <path d="M360 840 L840 840 L720 1120 L480 1120 Z" fill="${mid}" opacity=".5"/>
      <path d="M470 1010 Q600 1050 730 1010 L720 1050 Q600 1090 480 1050 Z" fill="${a}"/>
      <g transform="translate(600 1040)"><ellipse cx="-45" cy="0" rx="48" ry="26" fill="${a}" transform="rotate(-18)"/><ellipse cx="45" cy="0" rx="48" ry="26" fill="${a}" transform="rotate(18)"/><circle r="17" fill="#000" opacity=".2"/></g></g>`;
  } else if (kind === "giftset") {
    body = `<g transform="translate(600 ${900 + ty}) scale(${scale})">
      <ellipse cx="0" cy="300" rx="340" ry="36" fill="#000" opacity=".1"/>
      <rect x="-90" y="-200" width="110" height="170" rx="30" fill="${mid}"/><rect x="-100" y="-250" width="130" height="64" rx="18" fill="${a}"/>
      <rect x="60" y="-150" width="130" height="120" rx="40" fill="#fffaf6"/><rect x="50" y="-200" width="150" height="62" rx="16" fill="${a}" opacity=".85"/>
      <rect x="-300" y="-30" width="600" height="320" rx="36" fill="#fffaf6"/>
      <rect x="-300" y="-30" width="600" height="320" rx="36" fill="${mid}" opacity=".55"/>
      <rect x="-320" y="-80" width="640" height="84" rx="26" fill="${a}"/>
      <rect x="-26" y="-80" width="52" height="370" fill="#fff" opacity=".85"/>
      <g transform="translate(0 -92)"><ellipse cx="-62" cy="-10" rx="62" ry="34" fill="#fff" transform="rotate(-20)"/><ellipse cx="62" cy="-10" rx="62" ry="34" fill="#fff" transform="rotate(20)"/><circle r="22" fill="${a}"/></g></g>`;
  }
  return body;
}

function art(kind, paletteName, variant = 1, size = [1200, 1500]) {
  const p = PALETTES[paletteName] ?? PALETTES.plum;
  const [w, h] = size;
  const decor = variant === 2
    ? `${blossom(190, 250, 120, p.accent)}${blossom(1010, 1260, 150, p.bg[1])}${blossom(1020, 300, 70, p.bg[1])}${blossom(160, 1180, 80, p.accent)}`
    : `${sprig(150, 1480, 12, 1.1, p.accent)}${sprig(1060, 1500, -10, 1.0, p.accent, 0.3)}${blossom(1010, 230, 90, p.accent)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 1.34}" height="${h * 1.34}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#glow)"/>
    <circle cx="${v2(variant, 980, 220)}" cy="${v2(variant, 260, 1180)}" r="260" fill="#fff" opacity=".18"/>${decor}${product(kind, p, variant)}</svg>`;
}
const v2 = (variant, a, b) => (variant === 2 ? b : a);

async function saveImage(svg) {
  const key = crypto.randomBytes(12).toString("hex");
  const base = sharp(Buffer.from(svg)).resize({ width: 1600 });
  for (const w of [400, 800, 1600]) {
    await base.clone().resize({ width: w }).webp({ quality: 84 }).toFile(path.join(dir, `${key}-${w}.webp`));
  }
  return key;
}

async function bannerArt(paletteName, flip) {
  const p = PALETTES[paletteName];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient></defs>
    <rect width="1600" height="800" fill="url(#g)"/><circle cx="${flip ? 300 : 1300}" cy="320" r="360" fill="#fff" opacity=".2"/>
    ${sprig(flip ? 200 : 1300, 820, flip ? 14 : -12, 1.6, p.accent, 0.35)}${sprig(flip ? 520 : 1000, 840, flip ? -8 : 10, 1.3, p.accent, 0.3)}
    ${blossom(flip ? 380 : 1180, 220, 130, p.accent)}${blossom(flip ? 140 : 1440, 560, 90, p.bg[1])}${blossom(flip ? 560 : 1000, 600, 70, p.accent)}</svg>`;
  const key = crypto.randomBytes(12).toString("hex");
  const base = sharp(Buffer.from(svg));
  for (const w of [400, 800, 1600]) await base.clone().resize({ width: w }).webp({ quality: 82 }).toFile(path.join(dir, `${key}-${w}.webp`));
  return key;
}

// ----------------------------------------------------------------------------
// Sample catalogue
// ----------------------------------------------------------------------------
const slugify = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

const PRODUCTS = [
  { name: "Lavender Dream Body Scrub", cat: "body-care", scent: "lavender", kind: "jar", pal: "lavender", price: 9.5, stock: 24, size: "250 g", featured: 1, builder: 1, sold: 18,
    occ: ["birthday", "thank-you", "get-well-soon"], short: "A calming sugar scrub that leaves skin soft and gently scented.",
    desc: `<p>Fine sugar crystals blended with nourishing oils to polish away dullness and leave skin silky smooth.</p>${ul(["Calming lavender scent", "Gentle enough for weekly use", "Made in small batches"])}`,
    ing: "Cane sugar, sweet almond oil, coconut oil, vitamin E, lavender essential oil.", use: "Massage onto damp skin in circular motions, then rinse with warm water. Use once or twice a week." },
  { name: "Rose Petal Sugar Scrub", cat: "body-care", scent: "rose", kind: "jar", pal: "rose", price: 9, stock: 0, size: "250 g", featured: 1, builder: 1, sold: 26, option: "Scent",
    variants: [["Rose", "rose", 0, 14], ["Jasmine", "jasmine", 0, 9], ["Vanilla", "vanilla", 0.5, 3]],
    occ: ["valentines-day", "mothers-day", "birthday"], short: "Sugar scrub with real rose petals. Choose your favourite scent.",
    desc: `<p>A romantic scrub scattered with dried rose petals. Exfoliates, softens and perfumes in one step.</p>`,
    ing: "Cane sugar, jojoba oil, shea butter, dried rose petals, natural fragrance.", use: "Apply to damp skin, massage gently, rinse well." },
  { name: "Whipped Vanilla Body Butter", cat: "body-care", scent: "vanilla", kind: "jar", pal: "vanilla", price: 8.5, stock: 6, low: 8, size: "200 g", featured: 0, builder: 1, sold: 14,
    occ: ["new-baby", "get-well-soon", "thank-you"], short: "Light, whipped butter that melts into skin.",
    desc: `<p>Rich in shea and cocoa butter but light as a cloud. Absorbs quickly without feeling greasy.</p>`,
    ing: "Shea butter, cocoa butter, mango butter, arrowroot powder, vanilla extract.", use: "Warm a small amount between your palms and smooth over clean skin." },
  { name: "Citrus Glow Body Oil", cat: "body-care", scent: "citrus", kind: "bottle", pal: "citrus", price: 7.5, stock: 18, size: "100 ml", featured: 1, builder: 1, sold: 9,
    occ: ["birthday", "graduation"], short: "A bright, fast-absorbing oil with a gentle shimmer-free glow.",
    desc: `<p>Sweet orange and mandarin lift the senses while a blend of light oils nourishes skin.</p>`,
    ing: "Sweet almond oil, grapeseed oil, sweet orange essential oil, mandarin essential oil, vitamin E.", use: "Apply to damp skin after showering." },
  { name: "Jasmine Silk Body Lotion", cat: "body-care", scent: "jasmine", kind: "bottle", pal: "jasmine", price: 8, stock: 15, size: "250 ml", featured: 0, builder: 1, sold: 6,
    occ: ["wedding", "mothers-day"], short: "A silky everyday lotion with soft jasmine.",
    desc: `<p>Everyday moisture with a delicate floral scent.</p>`, ing: "Aloe vera, shea butter, glycerin, jasmine absolute, vitamin E.", use: "Smooth over skin morning and night." },
  { name: "Oat & Honey Soap", cat: "handmade-soaps", scent: "unscented", kind: "soap", pal: "coconut", price: 3.5, stock: 60, size: "100 g", featured: 1, builder: 1, sold: 31,
    occ: ["new-baby", "thank-you", "get-well-soon"], short: "Gentle cold-process soap with oats and honey.",
    desc: `<p>Creamy, mild and good for sensitive skin.</p>`, ing: "Olive oil, coconut oil, shea butter, oats, honey, sodium hydroxide (saponified).", use: "Lather in wet hands and wash. Keep dry between uses." },
  { name: "Lavender Goat-Milk Soap", cat: "handmade-soaps", scent: "lavender", kind: "soap", pal: "lavender", price: 3.8, stock: 45, size: "100 g", featured: 0, builder: 1, sold: 22,
    occ: ["birthday", "mothers-day", "get-well-soon"], short: "Soothing goat-milk soap scented with lavender.",
    desc: `<p>Cut and cured by hand for a long-lasting, luxurious lather.</p>`, ing: "Olive oil, coconut oil, goat milk, lavender essential oil, sodium hydroxide (saponified).", use: "Lather in wet hands and wash." },
  { name: "Rose Clay Soap", cat: "handmade-soaps", scent: "rose", kind: "soap", pal: "rose", price: 4, stock: 40, size: "100 g", featured: 0, builder: 1, sold: 11,
    occ: ["valentines-day", "mothers-day"], short: "Pink clay and rose for soft, clean skin.",
    desc: `<p>Rose clay gently cleanses while rose geranium scents.</p>`, ing: "Olive oil, coconut oil, rose clay, rose geranium oil, sodium hydroxide (saponified).", use: "Lather in wet hands and wash." },
  { name: "Mint Charcoal Soap", cat: "handmade-soaps", scent: "mint", kind: "soap", pal: "mint", price: 4, stock: 4, low: 6, size: "100 g", featured: 0, builder: 1, sold: 8,
    occ: ["graduation", "birthday"], short: "Refreshing charcoal and peppermint bar.",
    desc: `<p>Deeply cleansing and cooling.</p>`, ing: "Olive oil, coconut oil, activated charcoal, peppermint oil, sodium hydroxide (saponified).", use: "Lather in wet hands and wash." },
  { name: "Blush Grape-style Arrangement", cat: "grape-arrangements", scent: null, kind: "grape", pal: "rose", price: 28, stock: 5, size: "Serves 6", featured: 1, builder: 0, sold: 7,
    occ: ["wedding", "valentines-day", "mothers-day", "thank-you"], short: "A showpiece arranged like a cluster of grapes.",
    desc: `<p>A generous grape-style arrangement in soft blush tones, ready to present.</p>`, ing: "", use: "" },
  { name: "Royal Grape-style Arrangement", cat: "grape-arrangements", scent: null, kind: "grape", pal: "plum", price: 42, stock: 3, size: "Serves 10", featured: 0, builder: 0, sold: 4,
    occ: ["wedding", "eid", "ramadan"], short: "Our grandest arrangement for big celebrations.",
    desc: `<p>Larger and fuller, made to impress at weddings and family gatherings.</p>`, ing: "", use: "" },
  { name: "Blush Rose Bouquet", cat: "bouquets-fresh-flowers", scent: null, kind: "bouquet", pal: "rose", price: 22, track: 0, stock: 0, size: "", featured: 1, builder: 1, sold: 12,
    occ: ["mothers-day", "birthday", "valentines-day", "get-well-soon"], short: "Hand-tied bouquet of fresh blush roses.",
    desc: `<p>Fresh flowers, hand-tied the day they are delivered and wrapped in soft paper.</p>`, ing: "", use: "Trim the stems and keep in fresh water." },
  { name: "Seasonal Tulip Bouquet", cat: "bouquets-fresh-flowers", scent: null, kind: "bouquet", pal: "citrus", price: 18, track: 0, stock: 0, size: "", featured: 0, builder: 1, sold: 5,
    occ: ["birthday", "graduation", "thank-you"], short: "Bright seasonal tulips, wrapped by hand.",
    desc: `<p>A cheerful bunch that brightens any room.</p>`, ing: "", use: "Keep in fresh water, away from direct heat." },
  { name: "Self-Care Gift Set", cat: "gift-sets", scent: "lavender", kind: "giftset", pal: "lavender", price: 32, stock: 9, size: "4 pieces", featured: 1, builder: 0, sold: 12,
    occ: ["birthday", "thank-you", "mothers-day", "ramadan", "eid"], short: "Scrub, soap, body butter and oil in a gift box.",
    desc: `<p>Everything for a home spa evening:</p>${ul(["Lavender body scrub", "Goat-milk soap", "Vanilla body butter", "Citrus body oil"])}`, ing: "See individual products.", use: "" },
  { name: "New Baby Gentle Gift Set", cat: "gift-sets", scent: "unscented", kind: "giftset", pal: "coconut", price: 29, stock: 6, size: "3 pieces", featured: 0, builder: 0, sold: 3,
    occ: ["new-baby"], short: "Mild, unscented essentials for new parents.",
    desc: `<p>Oat & honey soap, whipped butter and a soft wash cloth, wrapped in a keepsake box.</p>`, ing: "See individual products.", use: "" },
  { name: "Eid Delights Gift Box", cat: "gift-sets", scent: "rose", kind: "giftset", pal: "plum", price: 36, stock: 10, size: "5 pieces", featured: 1, builder: 0, sold: 0,
    occ: ["eid", "ramadan"], short: "A festive box of rose and vanilla treats for the skin.",
    desc: `<p>A celebration gift with rose scrub, soaps and body butter.</p>`, ing: "See individual products.", use: "" },
];

const [cats] = await conn.query("SELECT id, slug FROM categories");
const [occs] = await conn.query("SELECT id, slug FROM occasions");
const [scents] = await conn.query("SELECT id, slug FROM scents");
const idOf = (list, slug) => list.find((x) => x.slug === slug)?.id ?? null;

console.log("Creating sample pictures and products (this takes a few seconds)...");
let index = 0;
const slugSeen = new Set((await conn.query("SELECT slug FROM products"))[0].map((r) => r.slug));
for (const p of PRODUCTS) {
  let slug = slugify(p.name);
  while (slugSeen.has(slug)) slug += "-2";
  slugSeen.add(slug);

  const [res] = await conn.query(
    `INSERT INTO products (slug, name, short_description, description, ingredients, how_to_use, size_label, category_id, scent_id, option_name,
        price, track_stock, stock_quantity, low_stock_threshold, is_active, is_featured, in_builder, sold_count, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, UTC_TIMESTAMP() - INTERVAL ? DAY)`,
    [slug, p.name, p.short, p.desc, p.ing || null, p.use || null, p.size || null, idOf(cats, p.cat), p.scent ? idOf(scents, p.scent) : null, p.option ?? null,
      p.price, p.track === 0 ? 0 : 1, p.stock, p.low ?? 5, p.featured, p.builder, p.sold, index],
  );
  const id = res.insertId;
  index += 1;

  for (const [i, variant] of [1, 2].entries()) {
    const key = await saveImage(art(p.kind, p.pal, variant));
    await conn.query("INSERT INTO product_images (product_id, image_key, alt, sort_order) VALUES (?, ?, ?, ?)", [id, key, `${p.name}${variant === 2 ? " (styled)" : ""}`, i]);
  }
  for (const o of p.occ) { const oid = idOf(occs, o); if (oid) await conn.query("INSERT IGNORE INTO product_occasions (product_id, occasion_id) VALUES (?, ?)", [id, oid]); }
  for (const [i, [label, scent, delta, stock]] of (p.variants ?? []).entries()) {
    await conn.query("INSERT INTO product_variants (product_id, label, scent_id, price_delta, stock_quantity, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      [id, label, idOf(scents, scent), delta, stock, i]);
  }
  process.stdout.write(".");
}
console.log("");

// Sample discount + coupon + banners + testimonials
const cat = (slug) => idOf(cats, slug);
await conn.query("INSERT INTO discounts (name, scope, category_id, type, value, is_active) VALUES (?, 'category', ?, 'percent', 15, 1)", ["Sample: 15% off handmade soaps", cat("handmade-soaps")]);
const [[giftSet]] = await conn.query("SELECT id FROM products WHERE name = 'Self-Care Gift Set' LIMIT 1");
await conn.query("INSERT INTO discounts (name, scope, product_id, type, value, is_active) VALUES (?, 'product', ?, 'fixed', 4, 1)", ["Sample: 4 JOD off the Self-Care Gift Set", giftSet.id]);
await conn.query("INSERT IGNORE INTO coupons (code, description, type, value, min_order, is_active) VALUES ('SAMPLE10', 'Sample coupon: 10% off orders from 15 JOD', 'percent', 10, 15, 1)");

const banner1 = await bannerArt("rose", false);
const banner2 = await bannerArt("lavender", true);
await conn.query("INSERT INTO banners (title, subtitle, button_text, button_url, image_key, sort_order, is_demo) VALUES (?, ?, ?, ?, ?, 1, 1)",
  ["Natural care, made by hand", "Scrubs, soaps and gifts crafted in small batches with gentle ingredients.", "Shop now", "/shop", null]);
await conn.query("INSERT INTO banners (title, subtitle, button_text, button_url, image_key, sort_order, is_demo) VALUES (?, ?, ?, ?, ?, 2, 1)",
  ["Build a gift they will remember", "Choose the box, fill it with their favourites and add a personal card.", "Build your own gift", "/gifts/build", null]);
// (The two generated banner pictures are attached to the sample banners.)
await conn.query("UPDATE banners SET image_key = ? WHERE title = 'Natural care, made by hand' AND is_demo = 1", [banner1]);
await conn.query("UPDATE banners SET image_key = ? WHERE title = 'Build a gift they will remember' AND is_demo = 1", [banner2]);

for (const [i, loc] of ["Amman", "Irbid", "Zarqa"].entries()) {
  await conn.query("INSERT INTO testimonials (author_name, location, quote, rating, sort_order, is_demo) VALUES (?, ?, ?, 5, ?, 1)",
    ["Sample customer", loc, "This is sample text that shows where customer words appear. Replace it with real feedback in Admin > Home page.", i + 1]);
}

console.log("\nDone. Sample content added:");
console.log(`  ${PRODUCTS.length} products with pictures, 2 banners, 3 testimonials, 2 discounts and the coupon code SAMPLE10.`);
console.log("Before you launch, remove all of it with:  npm run db:demo:remove");
await conn.end();
