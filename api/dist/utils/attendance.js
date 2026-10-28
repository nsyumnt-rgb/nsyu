"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAID_STATUS_FOR_PAYROLL = void 0;
exports.computeWorkingHours = computeWorkingHours;
exports.splitOvertime = splitOvertime;
exports.daysBetweenInclusive = daysBetweenInclusive;
exports.eachDateInRange = eachDateInRange;
/** Hours between two timestamps, rounded to 2 decimals, never negative. */
function computeWorkingHours(checkIn, checkOut) {
    const ms = checkOut.getTime() - checkIn.getTime();
    if (ms <= 0)
        return 0;
    return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}
/**
 * Splits total worked hours into regular vs overtime given a standard
 * shift length (default 8h/day) — used at check-out time to populate
 * Attendance.overtime_hours, which payroll later multiplies by the
 * employee's configured overtime_rate.
 */
function splitOvertime(workingHours, standardHours = 8) {
    if (workingHours <= standardHours)
        return { regularHours: workingHours, overtimeHours: 0 };
    return {
        regularHours: standardHours,
        overtimeHours: Math.round((workingHours - standardHours) * 100) / 100,
    };
}
/** Days a leave date range spans, inclusive (fractional half-day leaves aren't modeled — use two rows if needed). */
function daysBetweenInclusive(startDate, endDate) {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0)
        throw Object.assign(new Error("end_date must not be before start_date"), { status: 400 });
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}
/** All calendar dates (YYYY-MM-DD) in an inclusive range — used to stamp Attendance rows when a leave is approved. */
function eachDateInRange(startDate, endDate) {
    const dates = [];
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
exports.PAID_STATUS_FOR_PAYROLL = ["Present", "Late", "Holiday", "Week Off"];
//# sourceMappingURL=attendance.js.map