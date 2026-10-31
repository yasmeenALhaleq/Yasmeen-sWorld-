# Yasmeen World – online store

A complete online store for **Yasmeen World**, a natural handmade body care and gifting brand:
storefront, "Build Your Own Gift" builder, and a secure admin dashboard.
Built with **Next.js 16 (React 19)**, **TypeScript**, **Tailwind CSS 4** and **MySQL / MariaDB**.
Prices are in **Jordanian Dinar (JOD)**; the text is structured so **Arabic (right-to-left)** can be added later.

---

## Contents

1. [Quick start](#quick-start-windows--xampp)
2. [Configuration](#configuration)
3. [Creating the first admin account](#creating-the-first-admin-account)
4. [What is included](#what-is-included)
5. [Using the admin dashboard](#using-the-admin-dashboard)
6. [Database schema](#database-schema)
7. [How the important parts work](#how-the-important-parts-work)
8. [Email](#email)
9. [Adding online payment later](#adding-online-payment-later)
10. [Adding Arabic (RTL) later](#adding-arabic-rtl-later)
11. [Security](#security)
12. [Backups](#backups)
13. [Putting the store on a real server](#putting-the-store-on-a-real-server)
14. [Scripts](#scripts)
15. [Testing](#testing)
16. [Project structure](#project-structure)
17. [Troubleshooting](#troubleshooting)

---

## Quick start (Windows + XAMPP)

You need **Node.js 22.18 or newer** (24 is fine) and **MySQL or MariaDB** (XAMPP's MySQL works).

```powershell
# 1. In the XAMPP Control Panel, start MySQL.

# 2. Install the packages
npm install

# 3. Create your settings file, then open it and check the database values
copy .env.example .env.local

# 4. Create the database, tables and starter data (safe to run again)
npm run db:setup

# 5. Create YOUR admin account (you type the email and password; see below)
npm run admin:create

# 6. Optional: add sample products, banners and pictures so you can see the store full
npm run db:demo

# 7. Start the store
npm run dev
```

* Store: <http://localhost:3000>
* Admin: <http://localhost:3000/admin/login>

For the real thing use `npm run build` and then `npm start` (much faster than `dev`).

Run `npm run doctor` at any time: it checks Node, the database, tables, the upload folder, your admin account and email settings, and tells you what is missing.

> **Before launch:** run `npm run db:demo:remove` to delete all sample content. It only removes rows flagged as sample, never anything you added yourself.
> Also review **Delivery fees**, the **gift builder prices** and **Store settings** in the dashboard: the values that ship with the project are sensible placeholders.

---

## Configuration

Copy `.env.example` to `.env.local` (never commit it). Everything has a default that works with a standard XAMPP install.

| Variable | Default | Meaning |
|---|---|---|
| `SITE_URL` | `http://localhost:3000` | Public address of the site. Used in emails, the sitemap and canonical links. **Set it to your real address in production.** |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL server |
| `DB_USER` / `DB_PASSWORD` | `root` / *(empty)* | XAMPP defaults. In production create a dedicated user. |
| `DB_NAME` | `yasmeenworld` | Database name (created by `npm run db:setup`) |
| `UPLOAD_DIR` | `./storage/uploads` | Where product pictures and the logo are stored |
| `STORE_TIMEZONE` | `Asia/Amman` | Used for "today's orders", delivery dates and scheduled discounts |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | *(empty)* | Email sending. Leave `SMTP_HOST` empty to run without email. See [Email](#email). |

Settings the owner changes in the dashboard (store name, phone, WhatsApp, Instagram, delivery fees, logo and colours, banners ...) live in the database, not in `.env.local`.

---

## Creating the first admin account

There is deliberately **no default password and no sign-up page**. Run:

```powershell
npm run admin:create
```

It asks for an email, your name and a password (hidden while you type). The password must be at least 10 characters with letters and numbers. It is stored only as a **bcrypt** hash.

* Running it again with an existing email lets you **set a new password** (this also signs out every session and clears any login lock-out). This is the recovery path if you ever lose access and email is not set up.
* For automated setups you can instead set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment.
* "Forgot password" on the login page sends a one-hour, single-use link **by email**. Without SMTP configured, nothing can be emailed; in development the link is printed in the server console, in production use the command above.

---

## What is included

### Storefront
* **Home page**: editable hero banners (rotating), trust strip, shop by category, featured products, shop by occasion, best sellers (only products that have really sold), ready-made gift sets, "Build Your Own Gift" call to action, testimonials, Instagram link.
* **Categories** (add / rename / reorder / hide / delete in the admin): body care, handmade soaps, grape-style arrangements, bouquets & fresh flowers, gift sets.
* **Shop** with search, filters (category, price range, occasion, scent, in stock, on sale) and sorting (newest, best selling, price). Filtered pages are not indexed by search engines.
* **Product page**: image gallery with hover zoom and a full-screen viewer, price with strike-through old price and discount badge, rich description, ingredients, how to use, size, scent / variant options, stock status, quantity, add to cart, related products, JSON-LD structured data.
* **Cart and checkout**: name, phone, city, address, delivery date, gift message, notes, payment method (cash on delivery now; structure ready for online payment), coupon codes, delivery fee per city with a free-delivery threshold, order confirmation page and confirmation email.
* **Gifting, two paths**
  * *Ready-made gifts*: gift categories filterable by occasion (birthday, wedding, new baby, graduation, Mother's Day, Eid, Ramadan, Valentine's, thank you, get well soon).
  * *Build Your Own Gift*: 6 steps (occasion → base and size → products with live preview and running total → wrapping and ribbon → card message → review and add to cart). The admin controls which bases, sizes, products, wrapping, ribbons and occasions appear, and the maximum number of items per base size (enforced on the server too).
* Mobile first, WhatsApp button, SEO titles/descriptions, clean URLs (`/product/<slug>`, `/category/<slug>`), `sitemap.xml`, `robots.txt`.

### Admin dashboard (`/admin`)
* Secure login (bcrypt, sessions in the database, "Remember me", forgot-password email link, login attempt limiting, automatic logout after inactivity). Every admin page and action is protected.
* **Overview**: total sales, today's orders, pending orders, low-stock alerts, best sellers, 14-day sales chart.
* **Products**: add, edit, duplicate, hide/show, delete; drag-and-drop multi-image upload with reordering and main image; rich-text description; ingredients; price; stock; category; occasion tags; scent; variants with their own stock and price difference; SEO fields.
* **Pricing**: discounts for one product, a category or the whole store (percentage or fixed amount, optional start/end dates); coupon codes with usage limits and minimum order value.
* **Categories, occasions, scents**: add, edit, reorder, hide, delete.
* **Gift builder**: bases, sizes with prices and maximum items, wrapping styles, ribbon colours, eligible products, occasions.
* **Orders**: filter by status, search, update status (new, preparing, out for delivery, delivered, cancelled), mark payment as paid, see gift messages and delivery dates, history, **print order slip**.
* **Website**: home page banners and testimonials, delivery fees per city, **logo upload with automatic colour palette**, store name, contact phone, WhatsApp, Instagram.

---

## Using the admin dashboard

**Logo and colours** (*Logo & colours*)
1. Upload a PNG, SVG or JPG logo. The browser finds its dominant colours and builds a full palette: primary, secondary, accent, page background, cards, text, button and button hover.
2. Check the live preview. Change any colour with the colour picker or by typing a hex code; a warning appears if text would be hard to read.
3. **Save** applies the palette to the whole site (and to emails). **Reset to default colours** returns to mauve `#9B5478`, white, blush `#F6E9EF` and dark plum `#4A2338`.
SVG logos are converted to PNG on upload on purpose (an SVG served from your own domain could carry scripts).

**Discounts** – the best single discount wins for each product (they never stack). Dates are entered in Jordan time.

**Orders** – cancelling an order puts the stock, the sold count and the coupon use back automatically. A cancelled order cannot be reopened (create a new one instead).

**Stock** – with *Track stock* on, customers cannot buy more than you have. Turn it off for made-to-order items such as fresh flowers. When a product has options (variants), stock is tracked per option.

**Sample data** – products marked "Sample" came from `npm run db:demo` and can be removed with `npm run db:demo:remove`.

---

## Database schema

The full schema is in [`database/schema.sql`](database/schema.sql) (plain tables, no triggers or procedures, so it also imports in phpMyAdmin) and the starter data in [`database/seed.sql`](database/seed.sql). `npm run db:setup` applies both and can be repeated safely.

| Area | Tables |
|---|---|
| Admin access | `admins`, `admin_sessions` (stores only a hash of the cookie token), `login_attempts`, `password_resets` |
| Settings & content | `settings` (key/value), `banners`, `testimonials` |
| Catalogue | `categories`, `occasions`, `scents`, `products`, `product_images`, `product_occasions`, `product_variants` |
| Pricing | `discounts`, `coupons` |
| Delivery | `cities` (fee per city) |
| Gift builder | `gift_bases`, `gift_base_sizes`, `gift_options` (wrapping + ribbon) |
| Orders | `orders`, `order_items`, `order_events`, `payments` (ready for online payment), `email_outbox` |

Notes
* Money columns are `DECIMAL(10,3)` because 1 JOD = 1000 fils.
* All timestamps are stored in **UTC** and shown in `STORE_TIMEZONE`. Delivery dates are plain `DATE`s.
* Order items store a **snapshot** (name, price, picture) so old orders never change when products are edited or deleted.
* Characters are `utf8mb4` with the `utf8mb4_unicode_ci` collation, so Arabic text already works.

---

## How the important parts work

* **Prices are never trusted from the browser.** The cart only sends product ids and quantities. The server recalculates every price, discount, coupon, delivery fee and stock check (`src/server/services/cart.ts`). The same code runs again, inside a database transaction with row locks, when the order is placed, so two customers cannot buy the last item.
* **Discounts and coupons** are pure functions in `src/lib/pricing.ts` with unit tests.
* **Admin sessions**: a random token in an HttpOnly, SameSite cookie; only its SHA-256 is stored. Idle timeout 30 minutes (14 days with "Remember me"); absolute limit 12 hours (30 days). The browser shows a 60-second warning before signing out and keeps the session alive while you are typing.
* **Login limiting**: 5 failures per email + connection, 10 per email, 40 per connection within 15 minutes. Error messages never reveal whether an email exists.
* **Images** are re-encoded on upload with `sharp`: resized to 400 / 800 / 1600 px, converted to WebP, EXIF (including GPS) removed. They are served with a one-year cache.
* **Speed**: settings, the catalogue and the taxonomy are cached in memory for a few seconds and cleared the moment you save something in the admin. Images are cached for a year.
* **Time**: "today" always means today in Jordan, not in UTC.

---

## Email

Email is **optional**. Without SMTP settings, orders and everything else work normally.

To enable it, fill in `SMTP_*` and `MAIL_FROM` in `.env.local` and restart. Then:
* customers who typed an email get an order confirmation,
* the contact email from *Store settings* gets a "new order" alert,
* admins get password-reset links.

The store is strict about honesty: every attempt is written to the `email_outbox` table as `sent`, `failed` or `not_configured`, and the order confirmation page only says "a confirmation email was sent" when the mail server really accepted it. A mail problem never blocks an order. Reset links are never stored in the outbox.

---

## Adding online payment later

Checkout talks only to the registry in `src/server/payments/index.ts`.

1. Implement `PaymentProvider` for your gateway: `initiate()` creates the payment session and returns the gateway's `redirectUrl`.
2. Add a webhook route that confirms the payment and updates the `payments` row and `orders.payment_status`.
3. Register the provider in the `providers` array and switch `online_payments_enabled` on.

The `payments` table, the `payment_method` / `payment_status` order columns and the redirect handling in the checkout action already exist.

---

## Adding Arabic (RTL) later

* All customer-facing text is in `src/i18n/en.ts` and read through `t()`.
* Create `src/i18n/ar.ts` with the same keys, make `t()` in `src/i18n/index.ts` choose the dictionary for the visitor's locale (cookie or `/ar` URL prefix; the `dictionaries` table already has an `ar` slot), and set the direction for `ar` to `rtl` (`LOCALE_DIR`).
* `<html lang dir>` is already written by the root layout, and the CSS uses *logical* properties (`ms-`, `pe-`, `text-start` ...), so the layout mirrors by itself. Flip `dir="rtl"` in the browser dev tools to preview it.
* For Arabic product content add `name_ar` / `description_ar` columns (or a translations table) and pick them in `src/server/services/catalog.ts`.
* Prices use `<bdi>` so "9.000 JOD" keeps its order inside Arabic text.
* The admin dashboard is English only.

---

## Security

Built in: bcrypt (cost 12), DB-backed sessions with hashed tokens, HttpOnly + SameSite cookies, login throttling, constant-time login responses, CSRF protection (Next.js Server Action origin checks plus an Origin check on the upload and session endpoints), validation with zod on every form, parameterised SQL everywhere, HTML sanitising of rich text, HTML-escaped emails, image re-encoding, strict filename allow-list on `/uploads`, security headers, `noindex` and `no-store` on the admin area, a rate limit and honeypot on checkout, and unguessable order confirmation links (32 random hex characters).

Not included (add them if your situation needs them): a Content-Security-Policy header, two-factor login, a CAPTCHA, multiple admin roles. Rate limits and caches live in the memory of one server process, which is right for a single server; with several instances you would move them to Redis.

---

## Backups

Back up **two things**: the database and the uploads folder.

```powershell
# Database (XAMPP path shown)
C:\xampp\mysql\bin\mysqldump.exe -u root yasmeenworld > backup-yasmeenworld.sql

# Pictures
Copy-Item -Recurse storage\uploads backup-uploads
```

Restore with `mysql -u root yasmeenworld < backup-yasmeenworld.sql` and copy the pictures back. `npm run uploads:cleanup` lists pictures nothing uses any more (add `-- --delete` to remove them).

---

## Putting the store on a real server

1. Use Node.js 22.18+ and MySQL 5.7+/MariaDB 10.4+. Create a **dedicated database user** with rights on the one database; do not use `root`.
2. Copy the project, create `.env.local` with the real database, `SITE_URL=https://your-domain` and SMTP settings.
3. `npm ci && npm run db:setup && npm run admin:create && npm run build && npm start` (run `npm start` under a process manager such as pm2 or a systemd service).
4. Put a reverse proxy (nginx, Caddy ...) in front for **HTTPS**, and make it send the visitor's address in `X-Forwarded-For`. Session cookies become `Secure` automatically when `SITE_URL` starts with `https://`.
5. Keep `UPLOAD_DIR` on persistent storage and include it in your backups.
6. Run `npm run doctor` and, against the running site, `SMOKE_URL=https://your-domain npm run smoke`.

The catalogue is filtered in memory, which is comfortable up to a few thousand products.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:setup` | Creates the database, tables and starter data (repeatable) |
| `npm run admin:create` | Creates an admin account or sets a new password |
| `npm run db:demo` / `db:demo:remove` | Adds / removes sample content |
| `npm run doctor` | Checks the installation |
| `npm run smoke` | Checks a running copy of the site (pages, locked admin, tamper-proof carts) |
| `npm run uploads:cleanup` | Lists (or with `-- --delete` removes) unused pictures |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check |

---

## Testing

* `npm test` runs the unit tests (`tests/unit`): pricing and discounts, coupons, delivery fees, money in fils, time zones, slugs, the colour-palette generator (extraction, contrast, readability), the HTML sanitiser, and a check that every translation key used in the code exists.
* `npm run smoke` runs read-only checks against a running site.

During development the whole site was also exercised in a real browser (Edge driven by Playwright) against a separate test database: browsing and filters, cart and coupons, checkout validation and order placement, an oversell race between two buyers, price and stock tampering, the gift builder end to end, admin login/lock-out/idle logout/password reset, orders workflow and cancellation, product creation with real image uploads, discounts, settings, the logo/palette flow, and real email delivery to a local SMTP server (including a mail server that is down). Those browser scripts are not part of the repository.

---

## Project structure

```
database/            schema.sql and seed.sql
scripts/             db-setup, create-admin, db-demo, doctor, smoke-test, cleanup-uploads
tests/unit/          unit tests (run with: npm test)
storage/uploads/     uploaded pictures (created automatically, not in git)
src/
  app/               pages and routes
    (shop)/          storefront: home, shop, category, gifts, build, product, cart, checkout, order
    admin/           (auth)/ login, forgot / reset password · (panel)/ the protected dashboard · _actions/ server actions
    api/             cart quote, admin upload and session endpoints
    uploads/         serves pictures
  components/        ui/ shop/ admin/ building blocks
  i18n/              en.ts message dictionary and t()
  lib/               pure code shared by server and browser: pricing, palette, money, time, schemas
  server/            database pool, auth, services (catalog, cart, orders, images, email ...), payments
  proxy.ts           first gate in front of /admin
```

---

## Troubleshooting

* **"Could not connect to MySQL"** – start MySQL in the XAMPP Control Panel and check the `DB_*` values in `.env.local`.
* **Locked out of the admin** – wait 15 minutes, or run `npm run admin:create` with your email (this also clears lock-outs).
* **Password-reset email never arrives** – SMTP is not configured (see [Email](#email)); look at the `email_outbox` table to see what happened.
* **Windows: "EBUSY / resource busy" or very slow installs** – this project is easiest to work with outside OneDrive. OneDrive and antivirus scanners briefly lock files; the store tolerates this for uploads but `node_modules` and `.next` inside a synced folder are slow.
* **Pictures from deleted products are still in `storage/uploads`** – run `npm run uploads:cleanup`.
* **Changed something directly in the database and the site shows old data** – the site caches data for up to 30 seconds; changes made through the admin clear the cache immediately.
#   Y a s m e e n - s W o r l d -  
 