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
