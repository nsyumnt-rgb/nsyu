import { api } from "./client";
import type { ApiEnvelope, Customer } from "../types";

export function listCustomers(params?: { search?: string; status?: string }) {
  return api.get<ApiEnvelope<Customer[]>>("/customers", { params });
}

export function getCustomer(id: number | string) {
  return api.get<ApiEnvelope<Customer & { sales?: any[]; ledgerEntries?: any[]; emiPlans?: any[] }>>(`/customers/${id}`);
}

export function createCustomer(data: { name: string; phone: string; email?: string; address?: string }) {
  return api.post<ApiEnvelope<Customer>>("/customers", data);
}

export function updateCustomer(id: number, data: Partial<{ name: string; phone: string; email?: string; address?: string; status: "active" | "inactive" }>) {
  return api.put<ApiEnvelope<Customer>>(`/customers/${id}`, data);
}
