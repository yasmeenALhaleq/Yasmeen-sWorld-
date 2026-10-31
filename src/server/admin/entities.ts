import "server-only";
import { clearCache } from "@/server/cache";
import { env } from "@/server/env";
import { execute, query, queryOne } from "@/server/db/pool";
import { isImageKey } from "@/server/services/images";
import { purgeUnreferencedImages } from "@/server/services/admin-products";
import { uniqueSlug } from "@/server/slugs";
import { normalizeHex } from "@/lib/palette";
import { parseMoney } from "@/lib/money";
import { parseLocalInput, toLocalInput } from "@/lib/time";
import type { ClientEntity, ClientField, EntityRow, FieldOption, RowValue } from "@/lib/entity-types";

// Config-driven CRUD for the simple admin lists. Each entity says which table
// and columns it owns; the generic functions below do list / save / delete /
// reorder / toggle with validation. Table and column names only ever come from
// this file, never from user input.

interface EntityField extends ClientField {
  column: string;
  /** Where a select's options come from (resolved at render time). */
  optionsFrom?: "categories" | "products" | "gift_bases";
  transform?: "upper";
}

interface EntityDef {
  key: string;
  table: string;
  title: string;
  singular: string;
  description?: string;
  fields: EntityField[];
  orderBy: string;
  sortable?: boolean;
  /** Table has an `is_active` column. */
  hasActive?: boolean;
  /** Generate a unique slug from this field (table needs a `slug` column). */
  slugFrom?: string;
  /** Constant columns: used as a filter when listing and set when inserting. */
  fixed?: Record<string, string>;
  /** Rows referencing each id elsewhere: "SELECT x AS id, COUNT(*) AS n ... GROUP BY x". */
  usageSql?: string;
  usageLabel?: string;
  deleteHint?: string;
  /** Cross-field validation; return errors keyed by field name. */
  validate?: (values: Record<string, RowValue | Date>) => Record<string, string>;
}

const active = (): EntityField => ({
  name: "isActive", column: "is_active", label: "Visible on the website", type: "checkbox", defaultValue: true, inList: false,
});

export const ENTITIES: Record<string, EntityDef> = {
  categories: {
    key: "categories", table: "categories", title: "Categories", singular: "category",
    description: "Product categories shown in the menu and on the home page. Use the arrows to change their order.",
    orderBy: "sort_order, id", sortable: true, hasActive: true, slugFrom: "name",
    usageSql: "SELECT category_id AS id, COUNT(*) AS n FROM products WHERE category_id IS NOT NULL GROUP BY category_id",
    usageLabel: "Products",
    deleteHint: "Its products will stay in the shop but will no longer belong to a category.",
    fields: [
      { name: "name", column: "name", label: "Name", type: "text", required: true, maxLength: 120, inList: true },
      { name: "description", column: "description", label: "Short description", type: "textarea", maxLength: 500, nullable: true },
      { name: "image", column: "image_key", label: "Picture", type: "image", nullable: true, help: "Shown on the home page category cards." },
      { name: "isGift", column: "is_gift", label: "Counts as a ready-made gift category", type: "checkbox", inList: true,
        help: "Products in gift categories are listed on the Gifts page and filterable by occasion." },
      active(),
    ],
  },
  occasions: {
    key: "occasions", table: "occasions", title: "Occasions", singular: "occasion",
    description: "Used to tag products and to filter gifts (birthday, Eid ...).",
    orderBy: "sort_order, id", sortable: true, hasActive: true, slugFrom: "name",
    usageSql: "SELECT occasion_id AS id, COUNT(*) AS n FROM product_occasions GROUP BY occasion_id",
    usageLabel: "Products",
    fields: [
      { name: "name", column: "name", label: "Name", type: "text", required: true, maxLength: 120, inList: true },
      { name: "image", column: "image_key", label: "Picture", type: "image", nullable: true },
      { name: "inBuilder", column: "in_builder", label: "Offer in “Build Your Own Gift”", type: "checkbox", defaultValue: true, inList: true },
      active(),
    ],
  },
  scents: {
    key: "scents", table: "scents", title: "Scents", singular: "scent",
    description: "Scents customers can filter by. Attach them to products and variants.",
    orderBy: "sort_order, id", sortable: true, hasActive: true, slugFrom: "name",
    usageSql: "SELECT scent_id AS id, COUNT(*) AS n FROM products WHERE scent_id IS NOT NULL GROUP BY scent_id",
    usageLabel: "Products",
    fields: [
      { name: "name", column: "name", label: "Name", type: "text", required: true, maxLength: 120, inList: true },
      active(),
    ],
  },
  cities: {
    key: "cities", table: "cities", title: "Delivery fees", singular: "city",
    description: "Cities you deliver to and the delivery fee for each, in JOD. Deactivate a city to stop deliveries there.",
    orderBy: "sort_order, id", sortable: true, hasActive: true,
    fields: [
      { name: "name", column: "name", label: "City", type: "text", required: true, maxLength: 120, inList: true },
      { name: "fee", column: "fee", label: "Delivery fee (JOD)", type: "money", required: true, defaultValue: 0, inList: true },
      { ...active(), label: "Deliver here" },
    ],
  },
  banners: {
    key: "banners", table: "banners", title: "Home page banners", singular: "banner",
    description: "The large banners at the top of the home page. With more than one, they rotate automatically.",
    orderBy: "sort_order, id", sortable: true, hasActive: true,
    fields: [
      { name: "title", column: "title", label: "Heading", type: "text", required: true, maxLength: 160, inList: true },
      { name: "subtitle", column: "subtitle", label: "Sub-heading", type: "textarea", maxLength: 300, nullable: true },
      { name: "buttonText", column: "button_text", label: "Button text", type: "text", maxLength: 60, nullable: true, placeholder: "Shop now" },
      { name: "buttonUrl", column: "button_url", label: "Button link", type: "text", maxLength: 255, nullable: true, placeholder: "/shop",
        help: "A page on this site such as /shop or /gifts/build, or a full https:// address." },
      { name: "image", column: "image_key", label: "Banner picture", type: "image", nullable: true,
        help: "Wide pictures work best (about 1600 x 900). Leave empty for a soft coloured banner." },
      { ...active(), label: "Show this banner" },
    ],
    validate: (v): Record<string, string> => {
      const url = String(v.buttonUrl ?? "");
      return url && !/^(\/|https?:\/\/)/.test(url) ? { buttonUrl: "Start the link with / or https://" } : {};
    },
  },
  testimonials: {
    key: "testimonials", table: "testimonials", title: "Testimonials", singular: "testimonial",
    description: "Customer words shown on the home page. Only add real feedback from your customers.",
    orderBy: "sort_order, id", sortable: true, hasActive: true,
    fields: [
      { name: "authorName", column: "author_name", label: "Customer name", type: "text", required: true, maxLength: 120, inList: true },
      { name: "location", column: "location", label: "City", type: "text", maxLength: 80, nullable: true, inList: true },
      { name: "quote", column: "quote", label: "What they said", type: "textarea", required: true, maxLength: 600 },
      { name: "rating", column: "rating", label: "Stars (1-5)", type: "integer", required: true, min: 1, max: 5, defaultValue: 5, inList: true },
      { ...active(), label: "Show on the website" },
    ],
  },
  coupons: {
    key: "coupons", table: "coupons", title: "Coupon codes", singular: "coupon",
    description: "Codes customers type at checkout. Percentage or fixed amount, with an optional minimum order, usage limit and dates.",
    orderBy: "id DESC", hasActive: true,
    fields: [
      { name: "code", column: "code", label: "Code", type: "text", required: true, maxLength: 40, transform: "upper", inList: true,
        help: "Letters and numbers only, e.g. WELCOME10. Customers can type it in any case." },
      { name: "description", column: "description", label: "Note for yourself", type: "text", maxLength: 200, nullable: true },
      { name: "type", column: "type", label: "Discount type", type: "select", required: true, defaultValue: "percent", inList: true,
        options: [{ value: "percent", label: "Percentage (%)" }, { value: "fixed", label: "Fixed amount (JOD)" }] },
      { name: "value", column: "value", label: "Value", type: "money", required: true, inList: true, help: "Percent (1-100) or JOD, depending on the type." },
      { name: "minOrder", column: "min_order", label: "Minimum order (JOD)", type: "money", defaultValue: 0, help: "0 = no minimum." },
      { name: "maxUses", column: "max_uses", label: "Usage limit", type: "integer", nullable: true, min: 1, help: "Leave empty for unlimited.", inList: true },
      { name: "usedCount", column: "used_count", label: "Times used", type: "integer", readOnly: true, defaultValue: 0, inList: true },
      { name: "startsAt", column: "starts_at", label: "Starts", type: "datetime", nullable: true, help: "Optional. Jordan time." },
      { name: "endsAt", column: "ends_at", label: "Ends", type: "datetime", nullable: true, help: "Optional. Jordan time." },
      { ...active(), label: "Active" },
    ],
    validate: (v) => {
      const errors: Record<string, string> = {};
      if (!/^[A-Z0-9_-]{3,40}$/.test(String(v.code ?? ""))) errors.code = "Use 3-40 letters, numbers, - or _.";
      const value = Number(v.value);
      if (!(value > 0)) errors.value = "Enter a value greater than 0.";
      if (v.type === "percent" && value > 100) errors.value = "A percentage cannot be more than 100.";
      if (v.startsAt instanceof Date && v.endsAt instanceof Date && v.endsAt <= v.startsAt) errors.endsAt = "The end must be after the start.";
      return errors;
    },
  },
  discounts: {
    key: "discounts", table: "discounts", title: "Discounts & offers", singular: "offer",
    description: "Create an automatic offer for one product, a whole category, or the entire store. Choose a percentage or fixed amount, schedule its dates, and activate or hide it. If several offers apply to a product, the best one wins (they do not stack). For checkout codes, use Coupon codes.",
    orderBy: "id DESC", hasActive: true,
    fields: [
      { name: "name", column: "name", label: "Offer name", type: "text", required: true, maxLength: 120, inList: true, placeholder: "Summer sale" },
      { name: "scope", column: "scope", label: "Applies to", type: "select", required: true, defaultValue: "product", inList: true,
        options: [{ value: "product", label: "A single product" }, { value: "category", label: "A whole category" }, { value: "store", label: "The entire store" }] },
      { name: "productId", column: "product_id", label: "Product", type: "select", nullable: true, optionsFrom: "products", showWhen: { field: "scope", equals: "product" } },
      { name: "categoryId", column: "category_id", label: "Category", type: "select", nullable: true, optionsFrom: "categories", showWhen: { field: "scope", equals: "category" } },
      { name: "type", column: "type", label: "Offer type", type: "select", required: true, defaultValue: "percent", inList: true,
        options: [{ value: "percent", label: "Percentage (%)" }, { value: "fixed", label: "Fixed amount off (JOD)" }] },
      { name: "value", column: "value", label: "Discount value", type: "money", required: true, inList: true, help: "Enter a percentage from 1 to 100, or an amount in JOD, depending on the offer type." },
      { name: "startsAt", column: "starts_at", label: "Starts", type: "datetime", nullable: true, help: "Optional. Jordan time." },
      { name: "endsAt", column: "ends_at", label: "Ends", type: "datetime", nullable: true, help: "Optional. Jordan time." },
      { ...active(), label: "Active" },
    ],
    validate: (v) => {
      const errors: Record<string, string> = {};
      if (v.scope === "product" && !v.productId) errors.productId = "Choose a product.";
      if (v.scope === "category" && !v.categoryId) errors.categoryId = "Choose a category.";
      const value = Number(v.value);
      if (!(value > 0)) errors.value = "Enter a value greater than 0.";
      if (v.type === "percent" && value > 100) errors.value = "A percentage cannot be more than 100.";
      if (v.startsAt instanceof Date && v.endsAt instanceof Date && v.endsAt <= v.startsAt) errors.endsAt = "The end must be after the start.";
      return errors;
    },
  },
  gift_bases: {
    key: "gift_bases", table: "gift_bases", title: "Gift bases", singular: "base",
    description: "What the gift is arranged in: a box, a basket, a bouquet or a grape-style arrangement. Add sizes (and prices) for each below.",
    orderBy: "sort_order, id", sortable: true, hasActive: true,
    usageSql: "SELECT base_id AS id, COUNT(*) AS n FROM gift_base_sizes GROUP BY base_id",
    usageLabel: "Sizes",
    deleteHint: "Its sizes will be deleted too.",
    fields: [
      { name: "name", column: "name", label: "Name", type: "text", required: true, maxLength: 120, inList: true },
      { name: "type", column: "type", label: "Look in the preview", type: "select", required: true, defaultValue: "box", inList: true,
        options: [{ value: "box", label: "Gift box" }, { value: "basket", label: "Basket" }, { value: "bouquet", label: "Bouquet" }, { value: "grape", label: "Grape-style arrangement" }] },
      { name: "description", column: "description", label: "Short description", type: "textarea", maxLength: 300, nullable: true },
      { name: "image", column: "image_key", label: "Picture", type: "image", nullable: true },
      { ...active(), label: "Offer in the builder" },
    ],
  },
  gift_sizes: {
    key: "gift_sizes", table: "gift_base_sizes", title: "Base sizes & prices", singular: "size",
    description: "Each size has its own price and a maximum number of products that fit.",
    orderBy: "base_id, sort_order, id", sortable: false, hasActive: true,
    fields: [
      { name: "baseId", column: "base_id", label: "Base", type: "select", required: true, optionsFrom: "gift_bases", inList: true },
      { name: "name", column: "name", label: "Size name", type: "text", required: true, maxLength: 80, inList: true, placeholder: "Medium" },
      { name: "price", column: "price", label: "Price (JOD)", type: "money", required: true, inList: true },
      { name: "maxItems", column: "max_items", label: "Maximum products", type: "integer", required: true, min: 1, max: 50, defaultValue: 4, inList: true,
        help: "How many products customers can add to this size." },
      { ...active(), label: "Offer in the builder" },
    ],
  },
  gift_wrappings: {
    key: "gift_wrappings", table: "gift_options", title: "Wrapping styles", singular: "wrapping style",
    description: "Wrapping choices in step 4 of the builder. The colour is only used for the live preview.",
    orderBy: "sort_order, id", sortable: true, hasActive: true, fixed: { type: "wrapping" },
    fields: [
      { name: "name", column: "name", label: "Name", type: "text", required: true, maxLength: 120, inList: true },
      { name: "color", column: "color_hex", label: "Preview colour", type: "color", nullable: true, inList: true },
      { name: "price", column: "price", label: "Extra price (JOD)", type: "money", defaultValue: 0, inList: true },
      { ...active(), label: "Offer in the builder" },
    ],
  },
  gift_ribbons: {
    key: "gift_ribbons", table: "gift_options", title: "Ribbon colours", singular: "ribbon",
    description: "Ribbon colours in step 4 of the builder.",
    orderBy: "sort_order, id", sortable: true, hasActive: true, fixed: { type: "ribbon" },
    fields: [
      { name: "name", column: "name", label: "Name", type: "text", required: true, maxLength: 120, inList: true },
      { name: "color", column: "color_hex", label: "Colour", type: "color", required: true, inList: true },
      { name: "price", column: "price", label: "Extra price (JOD)", type: "money", defaultValue: 0, inList: true },
      { ...active(), label: "Offer in the builder" },
    ],
  },
};

export function getEntity(key: string): EntityDef | null {
  return ENTITIES[key] ?? null;
}

// ------------------------------------------------------------------ options

async function loadOptions(def: EntityDef): Promise<Record<string, FieldOption[]>> {
  const out: Record<string, FieldOption[]> = {};
  for (const f of def.fields) {
    if (!f.optionsFrom) continue;
    const rows =
      f.optionsFrom === "categories" ? await query<{ id: number; name: string }>("SELECT id, name FROM categories ORDER BY sort_order, name")
      : f.optionsFrom === "products" ? await query<{ id: number; name: string }>("SELECT id, name FROM products ORDER BY name")
      : await query<{ id: number; name: string }>("SELECT id, name FROM gift_bases ORDER BY sort_order, name");
    out[f.name] = rows.map((r) => ({ value: String(r.id), label: r.name }));
  }
  return out;
}

/** Entity description for the browser, with select options filled in. */
export async function toClientEntity(def: EntityDef): Promise<ClientEntity> {
  const options = await loadOptions(def);
  return {
    key: def.key, title: def.title, singular: def.singular, description: def.description,
    sortable: Boolean(def.sortable), hasActive: Boolean(def.hasActive), usageLabel: def.usageLabel, deleteHint: def.deleteHint,
    fields: def.fields.map(({ column: _c, optionsFrom: _o, transform: _t, ...f }) => ({ ...f, options: options[f.name] ?? f.options })),
  };
}

// ------------------------------------------------------------------ reading

function toRowValue(field: EntityField, raw: unknown): RowValue {
  if (raw === null || raw === undefined) return field.type === "checkbox" ? false : null;
  switch (field.type) {
    case "checkbox": return Number(raw) === 1;
    case "money": case "integer": return Number(raw);
    case "datetime": return raw instanceof Date ? toLocalInput(raw, env.timeZone) : null;
    case "select": return String(raw);
    default: return String(raw);
  }
}

export async function listEntityRows(def: EntityDef): Promise<EntityRow[]> {
  const where = def.fixed ? `WHERE ${Object.keys(def.fixed).map((c) => `${c} = ?`).join(" AND ")}` : "";
  const rows = await query<Record<string, unknown> & { id: number }>(
    `SELECT * FROM ${def.table} ${where} ORDER BY ${def.orderBy}`, def.fixed ? Object.values(def.fixed) : []);
  const usage = new Map<number, number>();
  if (def.usageSql) for (const u of await query<{ id: number; n: number }>(def.usageSql)) usage.set(u.id, Number(u.n));

  return rows.map((r) => ({
    id: r.id,
    usage: def.usageSql ? usage.get(r.id) ?? 0 : undefined,
    values: Object.fromEntries(def.fields.map((f) => [f.name, toRowValue(f, r[f.column])])),
  }));
}

// ----------------------------------------------------------------- parsing

export interface ParsedEntity {
  /** column -> value, ready for SQL. */
  columns: Record<string, string | number | Date | null>;
  errors: Record<string, string>;
}

/** Validates a submitted form against the entity's field definitions. */
export async function parseEntityForm(def: EntityDef, form: FormData): Promise<ParsedEntity> {
  const columns: ParsedEntity["columns"] = {};
  const errors: Record<string, string> = {};
  const typed: Record<string, RowValue | Date> = {};
  const options = await loadOptions(def);

  const scopeValues = new Map<string, string>();
  for (const f of def.fields) scopeValues.set(f.name, String(form.get(f.name) ?? "").trim());

  for (const f of def.fields) {
    if (f.readOnly) continue;
    // Fields hidden by `showWhen` are cleared, not validated.
    if (f.showWhen && scopeValues.get(f.showWhen.field) !== f.showWhen.equals) {
      columns[f.column] = null;
      typed[f.name] = null;
      continue;
    }
    const raw = scopeValues.get(f.name) ?? "";
    const fail = (message: string) => { errors[f.name] = message; };
    let value: string | number | Date | null = null;

    if (f.type === "checkbox") {
      value = form.get(f.name) === null ? 0 : 1;
    } else if (raw === "") {
      if (f.required) fail(`${f.label} is required.`);
      value = f.nullable ? null : f.type === "money" || f.type === "integer" ? Number(f.defaultValue ?? 0) : "";
    } else {
      switch (f.type) {
        case "text": case "textarea": {
          const max = f.maxLength ?? (f.type === "text" ? 200 : 1000);
          if (raw.length > max) fail(`${f.label} must be at most ${max} characters.`);
          value = f.transform === "upper" ? raw.toUpperCase() : raw;
          break;
        }
        case "money": {
          const m = parseMoney(raw);
          if (m === null) fail(`${f.label}: enter an amount like 12.500.`);
          else value = m;
          break;
        }
        case "integer": {
          const n = Number(raw);
          if (!Number.isInteger(n)) fail(`${f.label}: enter a whole number.`);
          else if (f.min !== undefined && n < f.min) fail(`${f.label} must be at least ${f.min}.`);
          else if (f.max !== undefined && n > f.max) fail(`${f.label} must be at most ${f.max}.`);
          else value = n;
          break;
        }
        case "select": {
          const allowed = (options[f.name] ?? f.options ?? []).map((o) => o.value);
          if (!allowed.includes(raw)) fail(`Please choose a valid ${f.label.toLowerCase()}.`);
          else value = f.optionsFrom ? Number(raw) : raw;
          break;
        }
        case "color": {
          const hex = normalizeHex(raw);
          if (!hex) fail(`${f.label}: enter a colour like #9B5275.`);
          else value = hex;
          break;
        }
        case "image": value = isImageKey(raw) ? raw : null; if (!isImageKey(raw)) fail("That picture could not be used. Upload it again."); break;
        case "datetime": {
          const d = parseLocalInput(raw, env.timeZone);
          if (!d) fail(`${f.label}: enter a valid date and time.`);
          else value = d;
          break;
        }
      }
    }
    columns[f.column] = value;
    typed[f.name] = value instanceof Date ? value : (value as RowValue);
  }

  Object.assign(errors, def.validate?.(typed) ?? {}, errors);
  return { columns, errors };
}

// ----------------------------------------------------------------- writing

export async function saveEntityRow(def: EntityDef, id: number | null, columns: ParsedEntity["columns"]): Promise<number> {
  const data = { ...columns, ...(def.fixed ?? {}) };
  const previousImage = id && "image_key" in columns
    ? (await queryOne<{ image_key: string | null }>(`SELECT image_key FROM ${def.table} WHERE id = ?`, [id]))?.image_key
    : null;

  // Slugs are created once. Renaming keeps the URL stable so old links and
  // bookmarks keep working.
  if (def.slugFrom && !id) {
    const source = String(columns[def.fields.find((f) => f.name === def.slugFrom)!.column] ?? "");
    (data as Record<string, unknown>).slug = await uniqueSlug(def.table, source, null);
  }

  const cols = Object.keys(data);
  const vals = Object.values(data);
  let savedId = id ?? 0;
  if (id) {
    await execute(`UPDATE ${def.table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...vals, id]);
  } else {
    const withOrder = def.sortable
      ? { ...data, sort_order: ((await queryOne<{ m: number | null }>(`SELECT MAX(sort_order) AS m FROM ${def.table}`))?.m ?? 0) + 1 }
      : data;
    const c = Object.keys(withOrder);
    const res = await execute(
      `INSERT INTO ${def.table} (${c.join(", ")}) VALUES (${c.map(() => "?").join(", ")})`, Object.values(withOrder));
    savedId = res.insertId;
  }

  if (previousImage && previousImage !== columns.image_key) await purgeUnreferencedImages([previousImage]);
  clearCache();
  return savedId;
}

export async function deleteEntityRow(def: EntityDef, id: number): Promise<void> {
  const image = def.fields.some((f) => f.column === "image_key")
    ? (await queryOne<{ image_key: string | null }>(`SELECT image_key FROM ${def.table} WHERE id = ?`, [id]))?.image_key
    : null;
  await execute(`DELETE FROM ${def.table} WHERE id = ?${def.fixed ? ` AND ${Object.keys(def.fixed).map((c) => `${c} = ?`).join(" AND ")}` : ""}`,
    [id, ...(def.fixed ? Object.values(def.fixed) : [])]);
  await purgeUnreferencedImages([image]);
  clearCache();
}

export async function setEntityActive(def: EntityDef, id: number, value: boolean): Promise<void> {
  if (!def.hasActive) return;
  await execute(`UPDATE ${def.table} SET is_active = ? WHERE id = ?`, [value ? 1 : 0, id]);
  clearCache();
}

/** Moves a row one position up or down, then renumbers the list 1..n. */
export async function moveEntityRow(def: EntityDef, id: number, direction: "up" | "down"): Promise<void> {
  if (!def.sortable) return;
  const where = def.fixed ? `WHERE ${Object.keys(def.fixed).map((c) => `${c} = ?`).join(" AND ")}` : "";
  const rows = await query<{ id: number }>(`SELECT id FROM ${def.table} ${where} ORDER BY ${def.orderBy}`, def.fixed ? Object.values(def.fixed) : []);
  const i = rows.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [index, r] of rows.entries()) await execute(`UPDATE ${def.table} SET sort_order = ? WHERE id = ?`, [index + 1, r.id]);
  clearCache();
}
