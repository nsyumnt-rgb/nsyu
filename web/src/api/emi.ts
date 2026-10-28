import { api } from "./client";
import type { ApiEnvelope, EMIPlan } from "../types";

export function listEmiPlans(params?: { customerId?: number; status?: string; shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<EMIPlan[]>>("/emi", { params });
}

export function getEmiPlan(planId: number | string) {
  return api.get<ApiEnvelope<EMIPlan>>(`/emi/${planId}`);
}

export function listDueInstallments(params?: { shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<any[]>>("/emi/due", { params });
}

export function payInstallment(installmentId: number, data: { amount: number; method: string; transactionId?: string; paymentDate?: string; notes?: string }) {
  return api.post<ApiEnvelope<any>>(`/emi/installment/${installmentId}/pay`, data);
}

export function cancelEmiPlan(planId: number, reason?: string) {
  return api.post<ApiEnvelope<EMIPlan>>(`/emi/${planId}/cancel`, { reason });
}
