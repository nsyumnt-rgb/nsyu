import { AttendanceStatus } from "../models/Attendance";

/** Hours between two timestamps, rounded to 2 decimals, never negative. */
export function computeWorkingHours(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Splits total worked hours into regular vs overtime given a standard
 * shift length (default 8h/day) — used at check-out time to populate
 * Attendance.overtime_hours, which payroll later multiplies by the
 * employee's configured overtime_rate.
 */
export function splitOvertime(workingHours: number, standardHours = 8): { regularHours: number; overtimeHours: number } {
  if (workingHours <= standardHours) return { regularHours: workingHours, overtimeHours: 0 };
  return {
    regularHours: standardHours,
    overtimeHours: Math.round((workingHours - standardHours) * 100) / 100,
  };
}

/** Days a leave date range spans, inclusive (fractional half-day leaves aren't modeled — use two rows if needed). */
export function daysBetweenInclusive(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd, 12, 0, 0);
  const end = new Date(ey, em - 1, ed, 12, 0, 0);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) throw Object.assign(new Error("end_date must not be before start_date"), { status: 400 });
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/** All calendar dates (YYYY-MM-DD) in an inclusive range — used to stamp Attendance rows when a leave is approved. */
export function eachDateInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd, 12, 0, 0);
  const end = new Date(ey, em - 1, ed, 12, 0, 0);
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export const PAID_STATUS_FOR_PAYROLL: AttendanceStatus[] = ["Present", "Late", "Holiday", "Week Off"];
