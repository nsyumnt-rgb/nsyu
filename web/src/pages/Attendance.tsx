import { useEffect, useState } from "react";
import { listAttendance, getMyAttendance, checkIn, checkOut, markAttendance } from "../api/attendance";
import { listEmployees } from "../api/employees";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { AttendanceRecord, Employee } from "../types";

function AttendanceInner() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const employee = useAuthStore((s) => s.employee);
  const { isOwner, can } = usePermission();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Punch state
  const [myToday, setMyToday] = useState<AttendanceRecord | null>(null);
  const [punching, setPunching] = useState(false);

  // Manager Mark Attendance Modal
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    employeeId: "",
    date: new Date().toISOString().slice(0, 10),
    status: "Present",
    remarks: "",
  });
  const [markSaving, setMarkSaving] = useState(false);

  const [allShopsToggle, setAllShopsToggle] = useState(false);

  function loadData() {
    setLoading(true);
    const params = {
      allShops: isOwner && allShopsToggle ? true : undefined,
    };

    listAttendance(params)
      .then((res) => setRecords(res.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load attendance records")))
      .finally(() => setLoading(false));

    if (employee) {
      getMyAttendance().then((res) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayRec = (res.data.data ?? []).find((r) => r.date === todayStr);
        setMyToday(todayRec || null);
      });
    }

    if (isOwner || can("attendance", "create")) {
      listEmployees().then((res) => setEmployees(res.data.data ?? []));
    }
  }

  useEffect(() => {
    loadData();
  }, [shopId, allShopsToggle]);

  async function handleCheckIn() {
    setPunching(true);
    try {
      await checkIn();
      loadData();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not punch in"));
    } finally {
      setPunching(false);
    }
  }

  async function handleCheckOut() {
    setPunching(true);
    try {
      await checkOut();
      loadData();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not punch out"));
    } finally {
      setPunching(false);
    }
  }

  async function handleMarkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMarkSaving(true);
    try {
      await markAttendance({
        employeeId: Number(markForm.employeeId),
        date: markForm.date,
        status: markForm.status,
        remarks: markForm.remarks || undefined,
      });
      setShowMarkModal(false);
      setMarkForm({ employeeId: "", date: new Date().toISOString().slice(0, 10), status: "Present", remarks: "" });
      loadData();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not mark attendance"));
    } finally {
      setMarkSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Staff Attendance & Time Tracking</h1>
          <p className="text-sm text-muted mt-1">
            Shop-wise employee attendance, overtime logging, and punch card records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOwner && (
            <label className="text-xs font-medium text-ink-700 cursor-pointer flex items-center gap-2 mr-2">
              <input
                type="checkbox"
                checked={allShopsToggle}
                onChange={(e) => setAllShopsToggle(e.target.checked)}
                className="rounded border-border text-accent-600 focus:ring-accent-500"
              />
              Consolidated (All Shops)
            </label>
          )}

          {(isOwner || can("attendance", "create")) && (
            <button className="btn-primary" onClick={() => setShowMarkModal(true)}>
              + Mark Attendance
            </button>
          )}
        </div>
      </div>

      {/* Employee Self-Service Punch Card */}
      {employee && (
        <div className="card p-5 bg-gradient-to-r from-canvas to-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              Today's Punch — {activeShop?.name}
            </div>
            <div className="text-base font-bold text-ink-900 mt-1">
              {myToday?.check_in
                ? `Checked in at ${new Date(myToday.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Not checked in yet today"}
            </div>
            {myToday?.check_out && (
              <div className="text-xs text-muted">
                Checked out at {new Date(myToday.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (
                {myToday.working_hours} hrs worked)
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!myToday?.check_in ? (
              <button
                disabled={punching}
                onClick={handleCheckIn}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700"
              >
                {punching ? "Punching…" : "Punch In Now"}
              </button>
            ) : !myToday.check_out ? (
              <button
                disabled={punching}
                onClick={handleCheckOut}
                className="btn-primary bg-amber-600 hover:bg-amber-700"
              >
                {punching ? "Punching…" : "Punch Out"}
              </button>
            ) : (
              <span className="badge bg-emerald-100 text-emerald-800 text-xs px-3 py-1">
                Completed for Today ({myToday.working_hours}h)
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Attendance Log Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              {allShopsToggle && <th>Shop</th>}
              <th>Check In</th>
              <th>Check Out</th>
              <th>Working Hours</th>
              <th>Overtime</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                  Loading attendance records…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={allShopsToggle ? 9 : 8} className="text-center py-8 text-muted">
                  No attendance records found for the current period.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs font-mono font-medium">
                    {new Date(r.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="font-medium text-ink-900">
                    <ReferenceLink type="employee" id={r.employee_id}>
                      {r.employee?.name || `Emp #${r.employee_id}`}
                    </ReferenceLink>
                  </td>
                  {allShopsToggle && (
                    <td>
                      <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                        {r.shop?.name || `Shop #${r.shop_id}`}
                      </span>
                    </td>
                  )}
                  <td className="font-mono text-xs text-muted">
                    {r.check_in
                      ? new Date(r.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                  <td className="font-mono text-xs text-muted">
                    {r.check_out
                      ? new Date(r.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                  <td className="font-mono text-xs font-medium">
                    {r.working_hours ? `${r.working_hours} hrs` : "—"}
                  </td>
                  <td className="font-mono text-xs text-amber-600 font-medium">
                    {r.overtime_hours && r.overtime_hours > 0 ? `+${r.overtime_hours} hrs` : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === "Present"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "Half Day"
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "Absent"
                          ? "bg-danger/10 text-danger"
                          : "bg-ink-100 text-ink-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-xs text-muted max-w-xs truncate">{r.remarks || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mark Attendance Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Mark Attendance — {activeShop?.name}</h2>
            <form onSubmit={handleMarkSubmit} className="space-y-4">
              <div>
                <label className="label">Employee *</label>
                <select
                  required
                  className="input"
                  value={markForm.employeeId}
                  onChange={(e) => setMarkForm({ ...markForm, employeeId: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  required
                  className="input font-mono"
                  value={markForm.date}
                  onChange={(e) => setMarkForm({ ...markForm, date: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Status *</label>
                <select
                  className="input"
                  value={markForm.status}
                  onChange={(e) => setMarkForm({ ...markForm, status: e.target.value })}
                >
                  <option value="Present">Present</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                  <option value="Leave">Leave</option>
                  <option value="Holiday">Holiday</option>
                  <option value="Week Off">Week Off</option>
                </select>
              </div>

              <div>
                <label className="label">Remarks</label>
                <input
                  className="input"
                  placeholder="Optional notes or reason"
                  value={markForm.remarks}
                  onChange={(e) => setMarkForm({ ...markForm, remarks: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" className="btn-secondary" onClick={() => setShowMarkModal(false)}>
                  Cancel
                </button>
                <button disabled={markSaving} className="btn-primary">
                  {markSaving ? "Saving…" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Attendance() {
  return (
    <RequireModule module="attendance">
      <AttendanceInner />
    </RequireModule>
  );
}
