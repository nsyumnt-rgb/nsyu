import { api } from "./client";
import type { ApiEnvelope, Customer } from "../types";

export function listCustomers(params?: { search?: string; status?: string }) {
  return api.get<ApiEnvelope<Customer[]>>("/customers", { params });
}

export function getCustomer(id: number | string) {
  return api.get<ApiEnvelope<Customer & { sales?: any[]; ledgerEntries?: any[]; emiPlans?: any[] }>>(`/customers/${id}`);
}

export function createCustomer(data: {
  name: string;
  shopName?: string;
  shop_name?: string;
  phone: string;
  email?: string;
  address?: string;
  openingBalance?: number;
  password?: string;
  gstin?: string;
  notes?: string;
}) {
  return api.post<ApiEnvelope<Customer>>("/customers", data);
}

export function updateCustomer(
  id: number,
  data: Partial<{
    name: string;
    shopName?: string;
    shop_name?: string;
    phone: string;
    email?: string;
    address?: string;
    openingBalance?: number;
    password?: string;
    status: "active" | "inactive";
  }>
) {
  return api.put<ApiEnvelope<Customer>>(`/customers/${id}`, data);
}

export function updateCustomerPortalAccess(id: number, enabled: boolean) {
  return api.post<ApiEnvelope<any>>(`/customers/${id}/portal-access`, { enabled });
}
