import { api } from "./client";
import type { ApiEnvelope, Purchase } from "../types";

export interface CreatePurchaseInput {
  supplierId: number;
  items: Array<{
    productId: number;
    quantity: number;
    rate: number;
    taxPercent?: number;
  }>;
  initialPaid?: number;
  paymentMethod?: string;
  notes?: string;
  transactionId?: string;
}

export function listPurchases(params?: { supplierId?: number; status?: string; from?: string; to?: string; shopId?: number; allShops?: boolean; limit?: number }) {
  return api.get<ApiEnvelope<Purchase[]>>("/purchases", { params });
}

export function getPurchase(purchaseId: number | string) {
  return api.get<ApiEnvelope<Purchase>>(`/purchases/${purchaseId}`);
}

export function createPurchase(data: CreatePurchaseInput) {
  return api.post<ApiEnvelope<Purchase>>("/purchases", data);
}

export function recordPurchasePayment(purchaseId: number, data: { amount: number; method: string; transactionId?: string; paymentDate?: string; notes?: string }) {
  return api.post<ApiEnvelope<any>>(`/purchases/${purchaseId}/payment`, data);
}

export function cancelPurchase(purchaseId: number, reason?: string) {
  return api.post<ApiEnvelope<Purchase>>(`/purchases/${purchaseId}/cancel`, { reason });
}

export function returnPurchase(purchaseId: number, items: Array<{ purchaseItemId: number; quantity: number }>, reason?: string) {
  return api.post<ApiEnvelope<any>>(`/purchases/${purchaseId}/return`, { items, reason });
}

export function downloadPurchasePdf(purchaseId: number) {
  return api.get(`/purchases/${purchaseId}/pdf`, { responseType: "blob" });
}
