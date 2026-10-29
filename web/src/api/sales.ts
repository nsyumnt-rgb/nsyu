import { api } from "./client";
import type { ApiEnvelope, Sale } from "../types";

export interface CreateSaleInput {
  customerId: number;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice?: number;
    discountAmount?: number;
    taxPercent?: number;
  }>;
  billDiscount?: number;
  overallDiscount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  isEmi?: boolean;
  emi?: {
    downPayment: number;
    interestRatePercent: number;
    tenureMonths: number;
    firstDueDate?: string;
    lateFeePercent?: number;
  };
}

export function listSales(params?: { customerId?: number; status?: string; from?: string; to?: string; shopId?: number; allShops?: boolean; limit?: number }) {
  return api.get<ApiEnvelope<Sale[]>>("/sales", { params });
}

export function getSale(saleId: number | string) {
  return api.get<ApiEnvelope<Sale>>(`/sales/${saleId}`);
}

export function createSale(data: CreateSaleInput) {
  return api.post<ApiEnvelope<Sale>>("/sales", data);
}

export function recordSalePayment(saleId: number, data: { amount: number; method: string; transactionId?: string; paymentDate?: string; notes?: string }) {
  return api.post<ApiEnvelope<any>>(`/sales/${saleId}/payments`, data);
}

export function cancelSale(saleId: number, reason?: string) {
  return api.post<ApiEnvelope<Sale>>(`/sales/${saleId}/cancel`, { reason });
}

export function returnSale(saleId: number, items: Array<{ saleItemId: number; quantity: number }>, reason?: string) {
  return api.post<ApiEnvelope<any>>(`/sales/${saleId}/returns`, { items, reason });
}

export function downloadInvoicePdf(saleId: number) {
  return api.get(`/sales/${saleId}/bill/pdf`, { responseType: "blob" });
}
