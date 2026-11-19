import { api } from "./client";
import type { ApiEnvelope, Supplier } from "../types";

export function listSuppliers() {
  return api.get<ApiEnvelope<Supplier[]>>("/suppliers");
}

export function getSupplier(id: number | string) {
  return api.get<ApiEnvelope<Supplier & { purchases?: any[]; ledgerEntries?: any[] }>>(`/suppliers/${id}`);
}

export interface CreateSupplierPayload {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  openingBalance?: number;
  password?: string;
  notes?: string;
}

export function createSupplier(payload: CreateSupplierPayload) {
  return api.post<ApiEnvelope<Supplier>>("/suppliers", payload);
}

