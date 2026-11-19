import { api } from "./client";
import type { ApiEnvelope, Shop } from "../types";

export function listShops() {
  return api.get<ApiEnvelope<Shop[]>>("/shops");
}

export function createShop(payload: Partial<Shop>) {
  return api.post<ApiEnvelope<Shop>>("/shops", payload);
}

export interface SwitchShopResult {
  accessToken: string;
  shop: Shop;
}

export function switchShop(shopId: number) {
  return api.post<ApiEnvelope<SwitchShopResult>>("/shops/switch", { shopId });
}

export function getShop(shopId: number) {
  return api.get<ApiEnvelope<Shop>>(`/shops/${shopId}`);
}

export function uploadShopBanner(shopId: number, file: File) {
  const form = new FormData();
  form.append("banner", file);
  return api.post<ApiEnvelope<{ bannerUrl: string; shop: Shop }>>(`/shops/${shopId}/banner`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteShopBanner(shopId: number) {
  return api.delete<ApiEnvelope<{ bannerUrl: null; shop: Shop }>>(`/shops/${shopId}/banner`);
}

export interface ShopPortalSettingsData {
  id?: number;
  shop_id?: number;
  show_stock_qty?: boolean;
  showStockQty?: boolean;
  allow_self_registration?: boolean;
  allowSelfRegistration?: boolean;
  allow_orders?: boolean;
  allowOrders?: boolean;
  min_order_value?: number;
  minOrderValue?: number;
  allow_customer_cancel?: boolean;
  allowCustomerCancel?: boolean;
  privacy_policy?: string | null;
  privacyPolicy?: string | null;
  terms_conditions?: string | null;
  termsConditions?: string | null;
  return_policy?: string | null;
  returnPolicy?: string | null;
  announcement_banner?: string | null;
  announcementBanner?: string | null;
  announcement_active?: boolean;
  announcementActive?: boolean;
}

export function getShopPortalSettings(shopId: number) {
  return api.get<ApiEnvelope<ShopPortalSettingsData>>(`/shops/${shopId}/portal-settings`);
}

export function updateShopPortalSettings(shopId: number, payload: Partial<ShopPortalSettingsData>) {
  return api.put<ApiEnvelope<ShopPortalSettingsData>>(`/shops/${shopId}/portal-settings`, payload);
}
