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
  // Backend routes: POST /customers/:customerId/portal/enable | /portal/disable
  return api.post<ApiEnvelope<any>>(`/customers/${id}/portal/${enabled ? "enable" : "disable"}`);
}

/** Sets/resets the customer's portal password (stored as a hash server-side). */
export function setCustomerPassword(id: number, password: string, confirmPassword: string) {
  return api.post<ApiEnvelope<{ customerId: number; accountStatus: string; created: boolean }>>(`/customers/${id}/password`, { password, confirmPassword });
}

export function sendCustomerReminder(customerId: number) {
  return api.post<ApiEnvelope<any>>(`/customers/${customerId}/send-reminder`);
}
