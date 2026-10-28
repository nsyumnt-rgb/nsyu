import { api } from "./client";
import type { ApiEnvelope, Employee } from "../types";

export function listEmployees() {
  return api.get<ApiEnvelope<Employee[]>>("/employees");
}

export function getEmployee(employeeId: number | string) {
  return api.get<ApiEnvelope<Employee & { shopAssignments?: any[]; salaryConfigs?: any[]; attendanceRecords?: any[]; payrolls?: any[] }>>(`/employees/${employeeId}`);
}

export function createEmployee(payload: { name: string; email: string; password: string; phone?: string }) {
  return api.post<ApiEnvelope<Employee>>("/employees", payload);
}

export function assignShopRole(payload: { employeeId: number; shopId: number; roleId: number }) {
  return api.post<ApiEnvelope<unknown>>("/employees/assign-shop", payload);
}

export function removeShopAssignment(payload: { employeeId: number; shopId: number }) {
  return api.post<ApiEnvelope<unknown>>("/employees/remove-shop", payload);
}

export function setEmployeeStatus(employeeId: number, status: "active" | "inactive") {
  return api.patch<ApiEnvelope<{ id: number; status: string }>>(`/employees/${employeeId}/status`, { status });
}
