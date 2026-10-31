-- =====================================================================
-- Yasmeen World - database schema
-- Target: MariaDB 10.4+ / MySQL 5.7+ (XAMPP compatible).
-- Plain tables only (no triggers / procedures) so phpMyAdmin can import it.
-- Safe to run repeatedly: every statement is CREATE TABLE IF NOT EXISTS.
-- Money columns are DECIMAL(10,3) because the Jordanian Dinar has 1000 fils.
-- All timestamps are stored in UTC; the app converts to the store time zone.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- ADMIN AUTHENTICATION
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  name          VARCHAR(120) NOT NULL DEFAULT '',
  password_hash VARCHAR(100) NOT NULL,                 -- bcrypt
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per signed-in browser. `id` is the SHA-256 of the cookie token, so a
-- leaked database dump cannot be used to hijack a session.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id           CHAR(64)     NOT NULL,
  admin_id     INT UNSIGNED NOT NULL,
  remember     TINYINT(1)   NOT NULL DEFAULT 0,
  ip           VARCHAR(64)  NULL,
  user_agent   VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME     NOT NULL,                  -- absolute lifetime
  PRIMARY KEY (id),
  KEY ix_sessions_admin (admin_id),
  KEY ix_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Used for login attempt limiting.
CREATE TABLE IF NOT EXISTS login_attempts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email      VARCHAR(190) NOT NULL,
  ip         VARCHAR(64)  NOT NULL,
  success    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_attempts_email (email, created_at),
  KEY ix_attempts_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id   INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL,                    -- SHA-256 of the emailed token
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resets_token (token_hash),
  KEY ix_resets_admin (admin_id),
  CONSTRAINT fk_resets_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- SITE SETTINGS, BANNERS, TESTIMONIALS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(80) NOT NULL,
  setting_value MEDIUMTEXT  NULL,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(160) NOT NULL,
  subtitle    VARCHAR(300) NULL,
  button_text VARCHAR(60)  NULL,
  button_url  VARCHAR(255) NULL,
  image_key   VARCHAR(64)  NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  is_demo     TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS testimonials (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_name VARCHAR(120) NOT NULL,
  location    VARCHAR(80)  NULL,
  quote       TEXT         NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL DEFAULT 5,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  is_demo     TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- CATALOG TAXONOMY
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(120) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  image_key   VARCHAR(64)  NULL,
  is_gift     TINYINT(1)   NOT NULL DEFAULT 0,         -- listed under "Ready-made gifts"
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS occasions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(120) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  image_key   VARCHAR(64)  NULL,
  in_builder  TINYINT(1)   NOT NULL DEFAULT 1,         -- offered in "Build Your Own Gift"
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_occasions_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scents (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(120) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_scents_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  slug                VARCHAR(160)  NOT NULL,
  name                VARCHAR(200)  NOT NULL,
  short_description   VARCHAR(300)  NULL,
  description         MEDIUMTEXT    NULL,               -- sanitized HTML from the rich text editor
  ingredients         TEXT          NULL,
  how_to_use          TEXT          NULL,
  size_label          VARCHAR(80)   NULL,               -- e.g. "250 g"
  category_id         INT UNSIGNED  NULL,
  scent_id            INT UNSIGNED  NULL,               -- the scent when the product has a single one
  option_name         VARCHAR(60)   NULL,               -- heading for variants, e.g. "Scent"
  price               DECIMAL(10,3) NOT NULL DEFAULT 0,
  track_stock         TINYINT(1)    NOT NULL DEFAULT 1,
  stock_quantity      INT           NOT NULL DEFAULT 0,
  low_stock_threshold INT           NOT NULL DEFAULT 5,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1, -- 0 = hidden from the storefront
  is_featured         TINYINT(1)    NOT NULL DEFAULT 0,
  in_builder          TINYINT(1)    NOT NULL DEFAULT 0, -- selectable in "Build Your Own Gift"
  sold_count          INT           NOT NULL DEFAULT 0,
  meta_title          VARCHAR(160)  NULL,
  meta_description    VARCHAR(320)  NULL,
  is_demo             TINYINT(1)    NOT NULL DEFAULT 0,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY ix_products_category (category_id),
  KEY ix_products_active (is_active, created_at),
  KEY ix_products_sold (sold_count),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_products_scent    FOREIGN KEY (scent_id)    REFERENCES scents (id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The image with the lowest sort_order is the product's main image.
CREATE TABLE IF NOT EXISTS product_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  image_key  VARCHAR(64)  NOT NULL,
  alt        VARCHAR(200) NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY ix_product_images (product_id, sort_order),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_occasions (
  product_id  INT UNSIGNED NOT NULL,
  occasion_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (product_id, occasion_id),
  KEY ix_product_occasions_occasion (occasion_id),
  CONSTRAINT fk_po_product  FOREIGN KEY (product_id)  REFERENCES products (id)  ON DELETE CASCADE,
  CONSTRAINT fk_po_occasion FOREIGN KEY (occasion_id) REFERENCES occasions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Variants (scent / size / colour ...). When a product has active variants,
-- stock is tracked per variant and the final price is price + price_delta.
CREATE TABLE IF NOT EXISTS product_variants (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  product_id     INT UNSIGNED  NOT NULL,
  label          VARCHAR(120)  NOT NULL,
  scent_id       INT UNSIGNED  NULL,
  price_delta    DECIMAL(10,3) NOT NULL DEFAULT 0,
  stock_quantity INT           NOT NULL DEFAULT 0,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order     INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY ix_variants_product (product_id, sort_order),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_variants_scent   FOREIGN KEY (scent_id)   REFERENCES scents (id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- DISCOUNTS AND COUPONS
-- ---------------------------------------------------------------------

-- Automatic discounts. For each product the single best active rule wins
-- (rules never stack).
CREATE TABLE IF NOT EXISTS discounts (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120)  NOT NULL,
  scope       ENUM('product','category','store') NOT NULL DEFAULT 'product',
  product_id  INT UNSIGNED  NULL,
  category_id INT UNSIGNED  NULL,
  type        ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  value       DECIMAL(10,3) NOT NULL,
  starts_at   DATETIME      NULL,
  ends_at     DATETIME      NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_discounts_active (is_active, starts_at, ends_at),
  CONSTRAINT fk_discounts_product  FOREIGN KEY (product_id)  REFERENCES products (id)   ON DELETE CASCADE,
  CONSTRAINT fk_discounts_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  code        VARCHAR(40)   NOT NULL,
  description VARCHAR(200)  NULL,
  type        ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  value       DECIMAL(10,3) NOT NULL,
  min_order   DECIMAL(10,3) NOT NULL DEFAULT 0,
  max_uses    INT           NULL,                        -- NULL = unlimited
  used_count  INT           NOT NULL DEFAULT 0,
  starts_at   DATETIME      NULL,
  ends_at     DATETIME      NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- DELIVERY
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cities (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120)  NOT NULL,
  fee        DECIMAL(10,3) NOT NULL DEFAULT 0,
  sort_order INT           NOT NULL DEFAULT 0,
  is_active  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cities_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- GIFT BUILDER
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gift_bases (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  type        ENUM('box','basket','bouquet','grape') NOT NULL DEFAULT 'box',
  description VARCHAR(300) NULL,
  image_key   VARCHAR(64)  NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gift_base_sizes (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  base_id    INT UNSIGNED  NOT NULL,
  name       VARCHAR(80)   NOT NULL,
  price      DECIMAL(10,3) NOT NULL DEFAULT 0,
  max_items  SMALLINT UNSIGNED NOT NULL DEFAULT 4,      -- max products that fit
  sort_order INT           NOT NULL DEFAULT 0,
  is_active  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_base_sizes_base (base_id, sort_order),
  CONSTRAINT fk_base_sizes_base FOREIGN KEY (base_id) REFERENCES gift_bases (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wrapping styles and ribbon colours.
CREATE TABLE IF NOT EXISTS gift_options (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  type       ENUM('wrapping','ribbon') NOT NULL,
  name       VARCHAR(120)  NOT NULL,
  color_hex  CHAR(7)       NULL,
  price      DECIMAL(10,3) NOT NULL DEFAULT 0,
  image_key  VARCHAR(64)   NULL,
  sort_order INT           NOT NULL DEFAULT 0,
  is_active  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_gift_options_type (type, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_number    VARCHAR(24)   NOT NULL,
  public_token    CHAR(32)      NOT NULL,               -- unguessable id for the confirmation page
  customer_name   VARCHAR(120)  NOT NULL,
  phone           VARCHAR(32)   NOT NULL,
  email           VARCHAR(190)  NULL,
  address         VARCHAR(500)  NOT NULL,
  city_id         INT UNSIGNED  NULL,
  city_name       VARCHAR(120)  NOT NULL,
  delivery_date   DATE          NOT NULL,
  gift_message    VARCHAR(600)  NULL,
  notes           VARCHAR(600)  NULL,
  payment_method  VARCHAR(24)   NOT NULL DEFAULT 'cod',
  payment_status  ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
  status          ENUM('new','preparing','out_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'new',
  subtotal        DECIMAL(10,3) NOT NULL DEFAULT 0,     -- after automatic discounts
  savings         DECIMAL(10,3) NOT NULL DEFAULT 0,     -- amount saved by automatic discounts
  coupon_id       INT UNSIGNED  NULL,
  coupon_code     VARCHAR(40)   NULL,
  coupon_discount DECIMAL(10,3) NOT NULL DEFAULT 0,
  delivery_fee    DECIMAL(10,3) NOT NULL DEFAULT 0,
  total           DECIMAL(10,3) NOT NULL DEFAULT 0,
  ip              VARCHAR(64)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  UNIQUE KEY uq_orders_token (public_token),
  KEY ix_orders_status (status, created_at),
  KEY ix_orders_created (created_at),
  KEY ix_orders_phone (phone),
  KEY ix_orders_delivery (delivery_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id      INT UNSIGNED  NOT NULL,
  kind          ENUM('product','custom_gift') NOT NULL DEFAULT 'product',
  product_id    INT UNSIGNED  NULL,                     -- NULL for custom gifts / deleted products
  variant_id    INT UNSIGNED  NULL,
  name          VARCHAR(255)  NOT NULL,                 -- snapshot at purchase time
  variant_label VARCHAR(120)  NULL,
  image_key     VARCHAR(64)   NULL,
  unit_price    DECIMAL(10,3) NOT NULL,
  quantity      INT           NOT NULL,
  line_total    DECIMAL(10,3) NOT NULL,
  meta          MEDIUMTEXT    NULL,                     -- JSON: contents of a custom gift
  PRIMARY KEY (id),
  KEY ix_order_items_order (order_id),
  KEY ix_order_items_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_events (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id   INT UNSIGNED NOT NULL,
  status     VARCHAR(30)  NOT NULL,
  note       VARCHAR(300) NULL,
  admin_id   INT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_order_events_order (order_id, created_at),
  CONSTRAINT fk_order_events_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ready for online payment providers. Cash on delivery does not create a row
-- here until a provider is plugged in (see src/server/payments).
CREATE TABLE IF NOT EXISTS payments (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id           INT UNSIGNED  NOT NULL,
  provider           VARCHAR(30)   NOT NULL,
  status             ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  amount             DECIMAL(10,3) NOT NULL,
  currency           CHAR(3)       NOT NULL DEFAULT 'JOD',
  provider_reference VARCHAR(120)  NULL,
  payload            MEDIUMTEXT    NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Honest record of every email the app tried to send.
CREATE TABLE IF NOT EXISTS email_outbox (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind      VARCHAR(40)  NOT NULL,
  to_email  VARCHAR(190) NOT NULL,
  subject   VARCHAR(255) NOT NULL,
  body_html MEDIUMTEXT   NULL,
  status    ENUM('sent','failed','not_configured') NOT NULL,
  error     VARCHAR(500) NULL,
  order_id  INT UNSIGNED NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_outbox_order (order_id),
  KEY ix_outbox_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
