import { api } from "./client";
import type { ApiEnvelope, AttendanceRecord } from "../types";

export function listAttendance(params?: { employeeId?: number; status?: string; from?: string; to?: string; shopId?: number; allShops?: boolean }) {
  return api.get<ApiEnvelope<AttendanceRecord[]>>("/attendance", { params });
}

export function getMyAttendance(params?: { from?: string; to?: string }) {
  return api.get<ApiEnvelope<AttendanceRecord[]>>("/attendance/me", { params });
}

export function checkIn(date?: string, remarks?: string) {
  return api.post<ApiEnvelope<AttendanceRecord>>("/attendance/check-in", { date, remarks });
}

export function checkOut(date?: string, remarks?: string) {
  return api.post<ApiEnvelope<AttendanceRecord>>("/attendance/check-out", { date, remarks });
}

export function markAttendance(data: { employeeId: number; date: string; status: string; checkIn?: string; checkOut?: string; remarks?: string }) {
  return api.post<ApiEnvelope<AttendanceRecord>>("/attendance/mark", data);
}
