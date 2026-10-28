import { api } from "./client";
import type { ApiEnvelope } from "../types";

export function listPayments(params?: { customerId?: number; saleId?: number; type?: string; shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<any[]>>("/payments", { params });
}

export function getPayment(paymentId: number | string) {
  return api.get<ApiEnvelope<any>>(`/payments/${paymentId}`);
}

export function cancelPayment(paymentId: number, reason?: string) {
  return api.post<ApiEnvelope<any>>(`/payments/${paymentId}/cancel`, { reason });
}

export function downloadReceiptPdf(paymentId: number) {
  return api.get(`/payments/${paymentId}/receipt/pdf`, { responseType: "blob" });
}

export function listSupplierPayments(params?: { supplierId?: number; shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<any[]>>("/supplier-ledger/payments", { params });
}
