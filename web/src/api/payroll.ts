import { api } from "./client";
import type { ApiEnvelope, PayrollRecord } from "../types";

export function listPayrolls(params?: { employeeId?: number; status?: string; shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<PayrollRecord[]>>("/payroll", { params });
}

export function getPayroll(payrollId: number | string) {
  return api.get<ApiEnvelope<PayrollRecord & { payments?: any[] }>>(`/payroll/${payrollId}`);
}

export function previewPayroll(params: { employeeId: number; periodStart: string; periodEnd: string; otherDeduction?: number; advanceDeduction?: number }) {
  return api.get<ApiEnvelope<any>>("/payroll/preview", { params });
}

export function runPayroll(data: { employeeId: number; periodStart: string; periodEnd: string; otherDeduction?: number; advanceDeduction?: number; notes?: string }) {
  return api.post<ApiEnvelope<PayrollRecord>>("/payroll/run", data);
}

export function paySalary(payrollId: number, data: { amount: number; method: string; transactionId?: string; paymentDate?: string; notes?: string }) {
  return api.post<ApiEnvelope<any>>(`/payroll/${payrollId}/pay`, data);
}
