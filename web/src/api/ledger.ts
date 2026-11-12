import { api } from "./client";
import type { ApiEnvelope, CustomerLedgerEntry, Customer } from "../types";

export interface CustomerLedgerResponse {
  customer: Customer;
  currentBalance: number;
  shopBalance: number;
  isShopScoped: boolean;
  scopedShopId: number | null;
  totalDebit: number;
  totalCredit: number;
  entries: CustomerLedgerEntry[];
}

export function getCustomerLedger(customerId: number, params?: { shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<CustomerLedgerResponse>>(`/ledger/customer/${customerId}`, { params });
}

export function listOutstandingBalances() {
  return api.get<ApiEnvelope<Customer[]>>("/ledger/outstanding");
}

export function recordLedgerPayment(data: {
  customerId: number;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  saleId?: number;
  invoiceNumber?: string;
  referenceCode?: string;
  idempotencyKey?: string;
  allowAdvance?: boolean;
}) {
  const headers = data.idempotencyKey ? { "x-idempotency-key": data.idempotencyKey } : undefined;
  return api.post<ApiEnvelope<CustomerLedgerEntry>>("/ledger/payment", data, headers ? { headers } : undefined);
}

export function getSupplierLedger(supplierId: number, params?: { shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<any>>(`/supplier-ledger/${supplierId}`, { params });
}

export function listSupplierOutstanding() {
  return api.get<ApiEnvelope<any[]>>("/supplier-ledger/outstanding");
}
