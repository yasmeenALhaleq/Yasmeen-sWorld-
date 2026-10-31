// Shared data shapes used by both server code and React components.
// Dates cross the server/client boundary as ISO strings.

export const ORDER_STATUSES = ["new", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const GIFT_BASE_TYPES = ["box", "basket", "bouquet", "grape"] as const;
export type GiftBaseType = (typeof GIFT_BASE_TYPES)[number];

export interface ImageRef {
  key: string;
  alt: string;
}

export interface NamedRef {
  id: number;
  slug: string;
  name: string;
}

// ----------------------------------------------------------------- catalog

export interface ProductCardData {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  categoryId: number | null;
  categorySlug: string | null;
  categoryName: string | null;
  /** List price before discounts (the lowest variant price when variants differ). */
  price: number;
  /** Selling price after the best active discount. */
  finalPrice: number;
  percentOff: number;
  /** True when variants have different prices, so the card says "From ...". */
  priceFrom: boolean;
  /** The customer must pick an option (scent / size ...) before adding to the cart. */
  hasVariants: boolean;
  optionName: string;
  quickVariants: ProductVariantData[];
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  image: ImageRef | null;
  inStock: boolean;
  lowStock: boolean;
  isFeatured: boolean;
  inBuilder: boolean;
  soldCount: number;
  createdAt: string;
  occasionIds: number[];
  scentIds: number[];
}

export interface ProductVariantData {
  id: number;
  label: string;
  scentId: number | null;
  price: number;
  finalPrice: number;
  percentOff: number;
  /** null = stock is not tracked (always available). */
  stock: number | null;
  inStock: boolean;
}

export interface ProductDetailData extends ProductCardData {
  description: string; // sanitized HTML
  ingredients: string;
  howToUse: string;
  sizeLabel: string;
  optionName: string;
  images: ImageRef[];
  variants: ProductVariantData[];
  occasions: NamedRef[];
  scentName: string | null;
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  metaTitle: string;
  metaDescription: string;
}

// -------------------------------------------------------------------- cart

export type CartLineInput =
  | { id: string; kind: "product"; productId: number; variantId: number | null; qty: number }
  | {
      id: string;
      kind: "gift";
      occasionId: number | null;
      sizeId: number;
      items: { productId: number; variantId: number | null; qty: number }[];
      wrappingId: number | null;
      ribbonId: number | null;
      cardMessage: string;
      qty: number;
    };

export interface GiftSummary {
  occasion: string | null;
  base: string;
  baseType: GiftBaseType;
  size: string;
  wrapping: string | null;
  ribbon: { name: string; color: string | null } | null;
  cardMessage: string;
  items: { productId: number; variantId: number | null; name: string; qty: number; unitPrice: number; image: ImageRef | null }[];
}

export interface PricedLine {
  id: string;
  kind: "product" | "gift";
  name: string;
  slug: string | null;
  variantLabel: string | null;
  image: ImageRef | null;
  unitPrice: number;
  originalUnitPrice: number;
  qty: number;
  lineTotal: number;
  /** Largest quantity that can be ordered (null = unlimited). */
  maxQty: number | null;
  /** Problems that block checkout (out of stock, no longer sold ...). */
  issues: string[];
  gift?: GiftSummary;
}

export interface CartQuote {
  lines: PricedLine[];
  subtotal: number;
  savings: number;
  coupon: { code: string; discount: number } | null;
  couponError: string | null;
  deliveryFee: number | null; // null until a city is chosen
  total: number;
  /** How much more to spend for free delivery (null when not applicable). */
  freeDeliveryRemaining: number | null;
  canCheckout: boolean;
}

// ------------------------------------------------------------------ orders

export interface OrderItemData {
  id: number;
  kind: "product" | "custom_gift";
  productId: number | null;
  name: string;
  variantLabel: string | null;
  imageKey: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  gift: GiftSummary | null;
}

export interface OrderEventData {
  status: string;
  note: string | null;
  createdAt: string;
}

export interface OrderData {
  id: number;
  orderNumber: string;
  publicToken: string;
  customerName: string;
  phone: string;
  email: string | null;
  address: string;
  cityName: string;
  deliveryDate: string; // YYYY-MM-DD
  giftMessage: string | null;
  notes: string | null;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  subtotal: number;
  savings: number;
  couponCode: string | null;
  couponDiscount: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItemData[];
  events: OrderEventData[];
}

// ----------------------------------------------------------- gift builder

export interface BuilderSize {
  id: number;
  name: string;
  price: number;
  maxItems: number;
}

export interface BuilderBase {
  id: number;
  name: string;
  type: GiftBaseType;
  description: string;
  image: ImageRef | null;
  sizes: BuilderSize[];
}

export interface BuilderOption {
  id: number;
  name: string;
  color: string | null;
  price: number;
}

export interface BuilderProduct extends ProductCardData {
  optionName: string;
  /** Selectable variants (scent / size ...). Empty when the product has none. */
  variants: { id: number; label: string; finalPrice: number; price: number; inStock: boolean; stock: number | null }[];
  /** Units available (null = not tracked), used to stop over-selecting. */
  stock: number | null;
}

export interface BuilderData {
  occasions: NamedRef[];
  bases: BuilderBase[];
  wrappings: BuilderOption[];
  ribbons: BuilderOption[];
  products: BuilderProduct[];
  categories: { id: number; name: string }[];
}
