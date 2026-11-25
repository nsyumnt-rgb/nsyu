import axios from "axios";
import { getApiBaseUrl } from "./client";
import { portalApi } from "./portal";
import { usePortalStore, type CartData } from "../store/portalStore";

/** Public, no-login marketplace API (MultiShop phase 1). */
const marketApi = axios.create({ baseURL: getApiBaseUrl() });

export interface MarketListing {
  productId: number;
  name: string;
  brand: string | null;
  sku: string;
  category: string | null;
  price: number;
  mrp: number;
  discountPercent: number;
  gstPercent: number;
  stock: number;
  inStock: boolean;
  imageUrl: string | null;
  shop: { id: number; name: string; code: string; address: string | null };
}

export interface MarketListingDetail extends MarketListing {
  description: string | null;
  images: { id: number; url: string; isPrimary: boolean }[];
  otherOffers: MarketListing[];
}

export interface MarketShop {
  id: number;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  logo: string | null;
  productCount: number;
  inStockCount: number;
}

export interface MarketShopDetail {
  id: number;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  /** Storefront banner uploaded by the owner (Settings → Shop), if any. */
  banner?: string | null;
  acceptsOrders: boolean;
  minOrderValue: number;
  categories: { name: string; count: number }[];
}

export interface Paged<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export type MarketSort = "relevance" | "newest" | "price_asc" | "price_desc";

export async function searchMarket(params: {
  q?: string;
  category?: string;
  shopId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: MarketSort;
  page?: number;
  limit?: number;
}): Promise<Paged<MarketListing>> {
  const res = await marketApi.get("/marketplace/products", { params: { ...params, inStock: params.inStock ? "true" : undefined } });
  return res.data;
}

export async function getMarketCategories(): Promise<{ name: string; count: number; imageUrl: string | null; icon?: string | null }[]> {
  const res = await marketApi.get("/marketplace/categories");
  return res.data?.data || [];
}

export async function getMarketShops(params?: { q?: string; page?: number; limit?: number }): Promise<Paged<MarketShop>> {
  const res = await marketApi.get("/marketplace/shops", { params });
  return res.data;
}

export async function getMarketShop(code: string): Promise<MarketShopDetail> {
  const res = await marketApi.get(`/marketplace/shops/${encodeURIComponent(code)}`);
  return res.data?.data;
}

export async function getMarketListing(shopId: number, productId: number): Promise<MarketListingDetail> {
  const res = await marketApi.get(`/marketplace/shops/${shopId}/products/${productId}`);
  return res.data?.data;
}

/* ── Cart grouped by shop (signed-in customers; uses the portal session) ── */

export interface MarketCartGroup {
  shop: { id: number; name: string; code: string };
  status: "active" | "pending_approval";
  cart: CartData | null;
}
export interface MarketCart {
  groups: MarketCartGroup[];
  itemCount: number;
  total: number;
}

const GUEST_CART_STORAGE_KEY = "nsyu.market.guest_cart";

export interface GuestCartItem {
  productId: number;
  name: string;
  brand?: string | null;
  sku?: string;
  category?: string | null;
  unitPrice: number;
  mrp?: number;
  discountPercent?: number;
  gstPercent?: number;
  imageUrl?: string | null;
  availableStock?: number;
  quantity: number;
  shop: {
    id: number;
    name: string;
    code: string;
    address?: string | null;
  };
}

export function getGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestCart(items: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save guest cart:", e);
  }
}

export function clearGuestCart(): void {
  try {
    localStorage.removeItem(GUEST_CART_STORAGE_KEY);
  } catch {}
}

export function guestCartToMarketCart(items: GuestCartItem[]): MarketCart {
  const shopMap = new Map<number, { shop: { id: number; name: string; code: string }; items: GuestCartItem[] }>();

  for (const it of items) {
    if (!it.shop || !it.shop.id) continue;
    let group = shopMap.get(it.shop.id);
    if (!group) {
      group = {
        shop: { id: it.shop.id, name: it.shop.name || `Shop #${it.shop.id}`, code: it.shop.code || String(it.shop.id) },
        items: [],
      };
      shopMap.set(it.shop.id, group);
    }
    group.items.push(it);
  }

  const groups: MarketCartGroup[] = [];
  let totalItemCount = 0;
  let overallTotal = 0;

  for (const group of shopMap.values()) {
    let groupSubtotal = 0;
    let groupItemCount = 0;

    const cartItems = group.items.map((it) => {
      const lineTotal = Math.round(it.unitPrice * it.quantity * 100) / 100;
      groupSubtotal += lineTotal;
      groupItemCount += it.quantity;

      const mrp = it.mrp && it.mrp > it.unitPrice ? it.mrp : it.unitPrice;
      const discountAmount = Math.max(0, Math.round((mrp - it.unitPrice) * it.quantity * 100) / 100);

      return {
        id: it.productId,
        productId: it.productId,
        name: it.name,
        sku: it.sku || "",
        brand: it.brand || null,
        imageUrl: it.imageUrl || null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent || 0,
        discountAmount,
        gstPercent: it.gstPercent || 0,
        taxAmount: 0,
        lineTotal,
        availableStock: it.availableStock && it.availableStock > 0 ? it.availableStock : 99,
      };
    });

    const roundedSubtotal = Math.round(groupSubtotal * 100) / 100;
    totalItemCount += groupItemCount;
    overallTotal += roundedSubtotal;

    groups.push({
      shop: group.shop,
      status: "active",
      cart: {
        cartId: 0,
        items: cartItems,
        subtotal: roundedSubtotal,
        discountAmount: 0,
        taxAmount: 0,
        estimatedTotal: roundedSubtotal,
        itemCount: groupItemCount,
      },
    });
  }

  return {
    groups,
    itemCount: totalItemCount,
    total: Math.round(overallTotal * 100) / 100,
  };
}

export async function getMarketCart(): Promise<MarketCart> {
  const token = usePortalStore.getState().accessToken;
  if (!token) {
    return guestCartToMarketCart(getGuestCart());
  }
  const res = await portalApi.get("/customer-portal/market/cart");
  return res.data?.data || { groups: [], itemCount: 0, total: 0 };
}

/** Sets the quantity of one product from one shop (0 removes it). Supports both guest and logged-in carts. */
export async function setMarketCartItem(
  shopId: number,
  productId: number,
  quantity: number,
  details?: Partial<GuestCartItem>
): Promise<MarketCart> {
  const token = usePortalStore.getState().accessToken;
  if (!token) {
    let items = getGuestCart();
    if (quantity <= 0) {
      items = items.filter((it) => !(it.shop.id === shopId && it.productId === productId));
    } else {
      const idx = items.findIndex((it) => it.shop.id === shopId && it.productId === productId);
      if (idx >= 0) {
        items[idx].quantity = quantity;
        if (details) Object.assign(items[idx], details);
      } else if (details && details.name && details.shop) {
        items.push({
          productId,
          name: details.name,
          brand: details.brand,
          sku: details.sku || "",
          category: details.category,
          unitPrice: details.unitPrice || 0,
          mrp: details.mrp,
          discountPercent: details.discountPercent || 0,
          gstPercent: details.gstPercent || 0,
          imageUrl: details.imageUrl,
          availableStock: details.availableStock ?? 99,
          quantity,
          shop: details.shop as any,
        });
      }
    }
    saveGuestCart(items);
    return guestCartToMarketCart(items);
  }

  const res = await portalApi.put(`/customer-portal/market/cart/${shopId}/items/${productId}`, { quantity });
  return res.data?.data;
}

/** Adds a market listing product to cart (guest or logged-in). */
export async function addListingToMarketCart(listing: MarketListing, qty: number = 1): Promise<MarketCart> {
  const token = usePortalStore.getState().accessToken;
  if (!token) {
    const items = getGuestCart();
    const existingIndex = items.findIndex(
      (it) => it.shop.id === listing.shop.id && it.productId === listing.productId
    );
    if (existingIndex >= 0) {
      const cur = items[existingIndex];
      const maxStock = listing.stock > 0 ? listing.stock : 99;
      cur.quantity = Math.min(maxStock, cur.quantity + qty);
      cur.unitPrice = listing.price;
      cur.mrp = listing.mrp;
      cur.availableStock = listing.stock > 0 ? listing.stock : (listing.inStock ? 99 : 0);
    } else {
      items.push({
        productId: listing.productId,
        name: listing.name,
        brand: listing.brand,
        sku: listing.sku,
        category: listing.category,
        unitPrice: listing.price,
        mrp: listing.mrp,
        discountPercent: listing.discountPercent,
        gstPercent: listing.gstPercent,
        imageUrl: listing.imageUrl,
        availableStock: listing.stock > 0 ? listing.stock : (listing.inStock ? 99 : 0),
        quantity: qty,
        shop: {
          id: listing.shop.id,
          name: listing.shop.name,
          code: listing.shop.code,
          address: listing.shop.address,
        },
      });
    }
    saveGuestCart(items);
    return guestCartToMarketCart(items);
  }

  const currentCart = await getMarketCart();
  const existingGroup = currentCart.groups.find((g) => g.shop.id === listing.shop.id);
  const existingItem = existingGroup?.cart?.items.find((it) => it.productId === listing.productId);
  const nextQty = (existingItem?.quantity || 0) + qty;
  return setMarketCartItem(listing.shop.id, listing.productId, nextQty);
}

/** Merges all items from guest cart into the customer's server cart after login/registration. */
export async function syncGuestCartToServer(): Promise<void> {
  const token = usePortalStore.getState().accessToken;
  if (!token) return;

  const items = getGuestCart();
  const pending = sessionStorage.getItem("pending_cart_item");
  if (pending) {
    try {
      const { shopId, productId, qty } = JSON.parse(pending);
      if (shopId && productId && !items.some((it) => it.shop.id === shopId && it.productId === productId)) {
        items.push({
          shop: { id: shopId, name: "", code: "" },
          productId,
          quantity: qty || 1,
          name: "",
          unitPrice: 0,
        } as any);
      }
    } catch {}
    sessionStorage.removeItem("pending_cart_item");
  }

  if (items.length === 0) return;

  for (const it of items) {
    try {
      await portalApi.put(`/customer-portal/market/cart/${it.shop.id}/items/${it.productId}`, {
        quantity: it.quantity,
      });
    } catch (err) {
      console.warn(`Failed to sync guest cart item ${it.productId} to shop ${it.shop.id}:`, err);
    }
  }

  clearGuestCart();
  window.dispatchEvent(new CustomEvent("market-cart-changed"));
}

/* ── Checkout: one order per shop ── */
export type PayMethod = "cod" | "upi" | "khata";
export interface CheckoutOptions {
  shops: { shopId: number; paymentMethods: PayMethod[] }[];
  address: { name: string; phone: string; line: string };
}
export interface CheckoutAddress {
  name: string;
  phone: string;
  line: string;
  landmark?: string;
  city?: string;
  pincode: string;
}
export interface CheckoutShopChoice {
  shopId: number;
  deliveryType: "delivery" | "pickup";
  paymentMethod: PayMethod;
  note?: string;
}
export interface CheckoutResult {
  shopId: number;
  shopName: string;
  ok: boolean;
  message?: string;
  orderId?: number;
  orderNumber?: string;
  total?: number;
  paymentMethod?: string;
}

export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  const res = await portalApi.get("/customer-portal/market/checkout/options");
  return res.data?.data;
}

/** Places one order per shop. Resolves with per-shop results even when some shops fail. */
export async function placeMarketCheckout(body: { checkoutId: string; address: CheckoutAddress; shops: CheckoutShopChoice[] }) {
  try {
    const res = await portalApi.post("/customer-portal/market/checkout", body);
    return res.data as { success: boolean; message: string; data: { results: CheckoutResult[]; cart: MarketCart } };
  } catch (err: any) {
    if (err?.response?.data?.data?.results) return err.response.data;
    throw err;
  }
}
