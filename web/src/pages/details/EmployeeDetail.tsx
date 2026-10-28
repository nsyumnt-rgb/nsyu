import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getEmployee } from "../../api/employees";
import ReferenceLink from "../../components/ReferenceLink";

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"attendance" | "payroll" | "shops">("attendance");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getEmployee(id)
      .then((res) => {
        if (res.data.success && res.data.data) {
          setEmployee(res.data.data);
        } else {
          setError("Employee not found");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load employee profile");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading employee profile...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-8 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Employee Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || `No employee matching ID "${id}" was found.`}</p>
        <button
          onClick={() => navigate("/app/employees")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Employees
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Go Back"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{employee.name}</h1>
              <span className="text-xs font-mono font-medium text-slate-400">EMP-{employee.id}</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                  employee.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {employee.status || "active"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {employee.email} {employee.phone ? `• ${employee.phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/app/payroll")}
            className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            Run Payroll
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Assigned Shops</span>
          <p className="text-2xl font-extrabold text-slate-800">
            {employee.shopAssignments?.length || 0} Store(s)
          </p>
          <span className="text-[11px] text-slate-400">Multi-shop access permissions</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Recent Attendance</span>
          <p className="text-2xl font-extrabold text-emerald-700">
            {employee.attendanceRecords?.filter((a: any) => a.status === "present").length || 0} Present
          </p>
          <span className="text-[11px] text-slate-400">Out of last {employee.attendanceRecords?.length || 0} logged days</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Salary Configuration</span>
          <p className="text-lg font-bold text-slate-800">
            ₹{Number(employee.salaryConfigs?.[0]?.basic_salary || 0).toLocaleString("en-IN")}/mo
          </p>
          <span className="text-[11px] text-slate-400">Active monthly base salary</span>
        </div>
      </div>

      {/* Tabs Section: Attendance, Payroll, Assigned Shops */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="flex border-b border-slate-200 px-4 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "attendance"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Attendance Logs ({employee.attendanceRecords?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("payroll")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "payroll"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Payroll Runs ({employee.payrolls?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("shops")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "shops"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Shop & Role Assignments ({employee.shopAssignments?.length || 0})
          </button>
        </div>

        {/* Tab 1: Attendance */}
        {activeTab === "attendance" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Check In</th>
                  <th className="py-2.5 px-4">Check Out</th>
                  <th className="py-2.5 px-4 text-right">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employee.attendanceRecords && employee.attendanceRecords.length > 0 ? (
                  employee.attendanceRecords.map((att: any) => (
                    <tr key={att.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {new Date(att.date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                            att.status === "present"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : att.status === "half_day"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{att.check_in || "—"}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{att.check_out || "—"}</td>
                      <td className="py-3 px-4 text-right text-slate-500">{att.notes || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">No attendance records logged yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Payroll Runs */}
        {activeTab === "payroll" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Payroll #</th>
                  <th className="py-2.5 px-4">Salary Period</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Net Payable</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employee.payrolls && employee.payrolls.length > 0 ? (
                  employee.payrolls.map((pr: any) => (
                    <tr key={pr.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">
                        <ReferenceLink type="payroll" id={pr.id} refNumber={`PAYROLL-${pr.id}`} />
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {new Date(pr.period_start).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} -{" "}
                        {new Date(pr.period_end).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {pr.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹{Number(pr.net_salary || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ReferenceLink type="payroll" id={pr.id} className="text-xs">
                          View Voucher →
                        </ReferenceLink>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">No payroll records generated yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Shop & Role Assignments */}
        {activeTab === "shops" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Shop Name</th>
                  <th className="py-2.5 px-4">Shop Code</th>
                  <th className="py-2.5 px-4">Assigned Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employee.shopAssignments && employee.shopAssignments.length > 0 ? (
                  employee.shopAssignments.map((sa: any) => (
                    <tr key={sa.id || sa.shop_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{sa.shop?.name || `Shop #${sa.shop_id}`}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{sa.shop?.code || "—"}</td>
                      <td className="py-3 px-4 font-medium text-blue-700">{sa.role?.name || "Staff"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 italic">No shop assignments configured</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
