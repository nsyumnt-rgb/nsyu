import { api } from "./client";
import type { ApiEnvelope } from "../types";

export interface ReportParams {
  from?: string;
  to?: string;
  shopId?: number;
  allShops?: boolean;
}

export function getSalesReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/sales", { params });
}

export function getPurchaseReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/purchase", { params });
}

export function getInventoryReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/inventory", { params });
}

export function getProfitReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/profit", { params });
}

export function getCustomerOutstandingReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/customer-outstanding", { params });
}

export function getSupplierOutstandingReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/supplier-outstanding", { params });
}

export function getEmiReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/emi", { params });
}

export function getPaymentsReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/payments", { params });
}

export function getShopPerformanceReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/shop-performance", { params });
}

export function getPayrollReport(params?: ReportParams) {
  return api.get<ApiEnvelope<any>>("/reports/payroll", { params });
}
