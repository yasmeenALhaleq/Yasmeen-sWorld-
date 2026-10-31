-- =====================================================================
-- Yasmeen World - starter data (NOT demo products).
-- Idempotent: INSERT IGNORE on unique keys, and NOT EXISTS guards for the
-- gift builder tables, so running it twice never creates duplicates.
-- Everything here is editable in the admin dashboard. Review the delivery
-- fees and gift builder prices before launch: they are sensible placeholders.
-- =====================================================================

SET NAMES utf8mb4;

-- ---- Site settings ---------------------------------------------------
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('store_name',              'Yasmeen World'),
  ('tagline',                 'Natural handmade body care & gifts'),
  ('contact_phone',           ''),
  ('contact_email',           ''),
  ('whatsapp_number',         ''),
  ('instagram_url',           ''),
  ('logo_key',                ''),
  ('theme',                   '{"primary":"#9B5275","secondary":"#D8B8C7","accent":"#EAD8E0","background":"#FAF6F8","surface":"#F3E8ED","text":"#352A2B","button":"#9B5275","buttonHover":"#9B5275"}'),
  ('announcement',            'Free delivery on orders over 40 JOD'),
  ('about_text',              'Yasmeen World makes natural, handmade body care and thoughtful gifts, crafted in small batches with gentle ingredients.'),
  ('meta_description',        'Natural handmade body care, soaps, bouquets and gift sets from Yasmeen World. Build your own gift and have it delivered across Jordan.'),
  ('delivery_lead_days',      '1'),
  ('delivery_max_days',       '60'),
  ('free_delivery_threshold', '40'),
  ('cod_enabled',             '1'),
  ('online_payments_enabled', '0'),
  ('schema_version',          '1');

-- ---- Categories -------------------------------------------------------
INSERT IGNORE INTO categories (slug, name, description, is_gift, sort_order) VALUES
  ('body-care',            'Body Care',               'Scrubs, butters, lotions and oils made with gentle natural ingredients.', 0, 1),
  ('handmade-soaps',       'Handmade Soaps',          'Cold-process soaps, cut and cured by hand.',                              0, 2),
  ('grape-arrangements',   'Grape-style Arrangements','Beautiful grape-style arrangements, ready to gift.',                      1, 3),
  ('bouquets-fresh-flowers','Bouquets & Fresh Flowers','Hand-tied bouquets and fresh flowers.',                                  1, 4),
  ('gift-sets',            'Body Care Gift Sets',     'Curated body care sets, beautifully wrapped.',                            1, 5);

-- ---- Occasions ----------------------------------------------------------
INSERT IGNORE INTO occasions (slug, name, in_builder, sort_order) VALUES
  ('birthday',       'Birthday',        1, 1),
  ('wedding',        'Wedding',         1, 2),
  ('new-baby',       'New Baby',        1, 3),
  ('graduation',     'Graduation',      1, 4),
  ('mothers-day',    'Mother''s Day',   1, 5),
  ('eid',            'Eid',             1, 6),
  ('ramadan',        'Ramadan',         1, 7),
  ('valentines-day', 'Valentine''s Day',1, 8),
  ('thank-you',      'Thank You',       1, 9),
  ('get-well-soon',  'Get Well Soon',   1, 10);

-- ---- Scents (used for the scent filter) ----------------------------------
INSERT IGNORE INTO scents (slug, name, sort_order) VALUES
  ('lavender',   'Lavender',   1),
  ('rose',       'Rose',       2),
  ('jasmine',    'Jasmine',    3),
  ('vanilla',    'Vanilla',    4),
  ('citrus',     'Citrus',     5),
  ('mint',       'Mint',       6),
  ('coconut',    'Coconut',    7),
  ('unscented',  'Unscented',  8);

-- ---- Delivery fees per city (JOD) ----------------------------------------
INSERT IGNORE INTO cities (name, fee, sort_order) VALUES
  ('Amman',   3.000, 1),
  ('Zarqa',   4.000, 2),
  ('Salt',    4.000, 3),
  ('Madaba',  4.000, 4),
  ('Irbid',   5.000, 5),
  ('Jerash',  5.000, 6),
  ('Ajloun',  5.000, 7),
  ('Mafraq',  5.000, 8),
  ('Karak',   6.000, 9),
  ('Tafilah', 6.000, 10),
  ('Ma''an',  6.000, 11),
  ('Aqaba',   7.000, 12);

-- ---- Gift builder: bases and sizes ---------------------------------------
INSERT INTO gift_bases (name, type, description, sort_order)
SELECT * FROM (
  SELECT 'Gift Box'               AS name, 'box'     AS type, 'An elegant rigid box, lined and ready to fill.' AS description, 1 AS sort_order
  UNION ALL SELECT 'Wicker Basket',          'basket',  'A natural wicker basket with a soft liner.',           2
  UNION ALL SELECT 'Hand-tied Bouquet',      'bouquet', 'Fresh flowers hand-tied with your chosen products.',    3
  UNION ALL SELECT 'Grape-style Arrangement','grape',   'A grape-style arrangement built around your picks.',    4
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM gift_bases);

INSERT INTO gift_base_sizes (base_id, name, price, max_items, sort_order)
SELECT b.id, s.name, s.price, s.max_items, s.sort_order
FROM (
  SELECT 'Gift Box' AS base, 'Small'  AS name,  8.000 AS price, 3 AS max_items, 1 AS sort_order
  UNION ALL SELECT 'Gift Box',               'Medium', 14.000, 5, 2
  UNION ALL SELECT 'Gift Box',               'Large',  22.000, 8, 3
  UNION ALL SELECT 'Wicker Basket',          'Small',  10.000, 4, 1
  UNION ALL SELECT 'Wicker Basket',          'Medium', 17.000, 6, 2
  UNION ALL SELECT 'Wicker Basket',          'Large',  26.000, 9, 3
  UNION ALL SELECT 'Hand-tied Bouquet',      'Small',  12.000, 3, 1
  UNION ALL SELECT 'Hand-tied Bouquet',      'Medium', 20.000, 5, 2
  UNION ALL SELECT 'Hand-tied Bouquet',      'Large',  30.000, 7, 3
  UNION ALL SELECT 'Grape-style Arrangement','Medium', 18.000, 5, 1
  UNION ALL SELECT 'Grape-style Arrangement','Large',  28.000, 8, 2
) AS s
JOIN gift_bases b ON b.name = s.base
WHERE NOT EXISTS (SELECT 1 FROM gift_base_sizes);

-- ---- Gift builder: wrapping styles and ribbon colours ---------------------
INSERT INTO gift_options (type, name, color_hex, price, sort_order)
SELECT * FROM (
  SELECT 'wrapping' AS type, 'Kraft Paper' AS name, '#C9B08A' AS color_hex, 0.000 AS price, 1 AS sort_order
  UNION ALL SELECT 'wrapping', 'Floral Tissue',        '#F3D6E3', 1.500, 2
  UNION ALL SELECT 'wrapping', 'Satin Wrap',           '#E7D5C0', 2.500, 3
  UNION ALL SELECT 'wrapping', 'Luxury Cellophane',    '#EAF3F4', 2.000, 4
  UNION ALL SELECT 'ribbon',   'Blush Pink',           '#E8B4C8', 0.000, 1
  UNION ALL SELECT 'ribbon',   'Plum',                 '#9B5478', 0.000, 2
  UNION ALL SELECT 'ribbon',   'Ivory',                '#F5EFE6', 0.000, 3
  UNION ALL SELECT 'ribbon',   'Sage Green',           '#8AA38B', 0.000, 4
  UNION ALL SELECT 'ribbon',   'Gold',                 '#C9A24A', 0.500, 5
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM gift_options);
