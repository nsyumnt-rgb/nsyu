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
