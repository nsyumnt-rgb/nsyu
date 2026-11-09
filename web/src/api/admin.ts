import { api } from "./client";
import type { ApiEnvelope } from "../types";

export interface PlatformDashboardData {
  total_shops: number;
  active_shops: number;
  suspended_shops: number;
  total_users: number;
  total_owners: number;
  total_employees: number;
  total_customers: number;
  total_sales_amount: number;
  total_sales_count: number;
  recent_activity: PlatformAuditLogEntry[];
}

export interface PlatformAuditLogEntry {
  id: number;
  super_admin_id: number;
  super_admin_email: string;
  action: string;
  target_type: string;
  target_id?: number | null;
  target_name?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface AdminShopItem {
  id: number;
  owner_id: number;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: "active" | "inactive" | "suspended";
  created_at?: string;
  owner?: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    status: string;
  };
}

export interface AdminOwnerItem {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  status: "active" | "inactive" | "suspended";
  is_super_admin: boolean;
  role: string;
  created_at: string;
  shops?: {
    id: number;
    name: string;
    code: string;
    status: string;
  }[];
}

export interface AdminShopSupportData {
  shop: AdminShopItem;
  stats: {
    billsCount: number;
    ordersCount: number;
    customersCount: number;
    productsCount: number;
  };
  recentBills: any[];
  recentOrders: any[];
  inventorySummary: any[];
  customersList: any[];
}

export function fetchAdminDashboard() {
  return api.get<ApiEnvelope<PlatformDashboardData>>("/admin/dashboard");
}

export function fetchAdminShops() {
  return api.get<ApiEnvelope<AdminShopItem[]>>("/admin/shops");
}

export function createAdminShop(data: {
  name: string;
  code: string;
  owner_id: number;
  address?: string;
  phone?: string;
  email?: string;
}) {
  return api.post<ApiEnvelope<AdminShopItem>>("/admin/shops", data);
}

export function updateAdminShop(
  id: number,
  data: { name?: string; address?: string; phone?: string; email?: string }
) {
  return api.put<ApiEnvelope<AdminShopItem>>(`/admin/shops/${id}`, data);
}

export function toggleAdminShopStatus(id: number, status: "active" | "suspended", reason?: string) {
  return api.patch<ApiEnvelope<AdminShopItem>>(`/admin/shops/${id}/status`, { status, reason });
}

export function fetchAdminOwners() {
  return api.get<ApiEnvelope<AdminOwnerItem[]>>("/admin/owners");
}

export function createAdminOwner(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  return api.post<ApiEnvelope<AdminOwnerItem>>("/admin/owners", data);
}

export function resetAdminOwnerPassword(id: number, password: string) {
  return api.patch<ApiEnvelope<null>>(`/admin/owners/${id}/password`, { password });
}

export function toggleAdminOwnerStatus(
  id: number,
  status: "active" | "inactive" | "suspended",
  reason?: string
) {
  return api.patch<ApiEnvelope<any>>(`/admin/owners/${id}/status`, { status, reason });
}

export function fetchAdminAuditLogs(page = 1, limit = 20) {
  return api.get<
    ApiEnvelope<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      logs: PlatformAuditLogEntry[];
    }>
  >(`/admin/audit-logs?page=${page}&limit=${limit}`);
}

export function fetchAdminShopSupportData(id: number) {
  return api.get<ApiEnvelope<AdminShopSupportData>>(`/admin/shops/${id}/data`);
}
