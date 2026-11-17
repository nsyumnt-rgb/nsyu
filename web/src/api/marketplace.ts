import axios from "axios";
import { getApiBaseUrl } from "./client";
import { portalApi } from "./portal";
import type { CartData } from "../store/portalStore";

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

export async function getMarketCategories(): Promise<{ name: string; count: number; imageUrl: string | null }[]> {
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

export async function getMarketCart(): Promise<MarketCart> {
  const res = await portalApi.get("/customer-portal/market/cart");
  return res.data?.data;
}

/** Sets the quantity of one product from one shop (0 removes it). */
export async function setMarketCartItem(shopId: number, productId: number, quantity: number): Promise<MarketCart> {
  const res = await portalApi.put(`/customer-portal/market/cart/${shopId}/items/${productId}`, { quantity });
  return res.data?.data;
}
