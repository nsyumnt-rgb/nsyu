import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminDashboard, type PlatformDashboardData } from "../../api/admin";

export default function AdminDashboard() {
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminDashboard();
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-400">Loading platform metrics from database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-800 rounded-xl text-red-200">
        <h3 className="font-bold text-lg mb-1">Failed to Load Dashboard</h3>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Overview</h1>
          <p className="text-sm text-slate-400">Real-time multi-tenant database analytics across all registered shops</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
          <Link
            to="/admin/shops"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
          >
            Manage Shops
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Shops */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
            <span>TOTAL SHOPS</span>
            <div className="w-8 h-8 rounded-lg bg-purple-900/40 text-purple-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mb-2">{data?.total_shops ?? 0}</div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded">
              {data?.active_shops ?? 0} Active
            </span>
            <span className="px-2 py-0.5 bg-rose-950/80 text-rose-400 border border-rose-800/60 rounded">
              {data?.suspended_shops ?? 0} Suspended
            </span>
          </div>
        </div>

        {/* Card 2: Total Platform Users */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
            <span>TOTAL USERS</span>
            <div className="w-8 h-8 rounded-lg bg-blue-900/40 text-blue-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mb-2">{data?.total_users ?? 0}</div>
          <div className="text-xs text-slate-400 truncate">
            {data?.total_owners ?? 0} Owners • {data?.total_employees ?? 0} Staff • {data?.total_customers ?? 0} Customers
          </div>
        </div>

        {/* Card 3: Total Platform Sales Amount */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
            <span>TOTAL SALES (CROSS-SHOP)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-900/40 text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mb-2">
            ₹{Number(data?.total_sales_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400">
            Across {data?.total_sales_count ?? 0} settled bills
          </div>
        </div>

        {/* Card 4: Governance & Audit */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
            <span>SECURITY AUDIT</span>
            <div className="w-8 h-8 rounded-lg bg-amber-900/40 text-amber-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mb-2">
            {data?.recent_activity?.length ?? 0}
          </div>
          <div className="text-xs text-slate-400">
            Recent Super Admin operations logged
          </div>
        </div>
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/shops"
          className="p-5 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-purple-600/60 hover:bg-slate-950 transition flex items-center space-x-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-purple-400 transition">Register New Shop</h3>
            <p className="text-xs text-slate-400">Onboard a business tenant and configure code</p>
          </div>
        </Link>

        <Link
          to="/admin/owners"
          className="p-5 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-purple-600/60 hover:bg-slate-950 transition flex items-center space-x-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition">Create First Owner</h3>
            <p className="text-xs text-slate-400">Assign first owner credentials and seed roles</p>
          </div>
        </Link>

        <Link
          to="/admin/audit-logs"
          className="p-5 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-purple-600/60 hover:bg-slate-950 transition flex items-center space-x-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition">Review Audit Logs</h3>
            <p className="text-xs text-slate-400">Complete historical record of platform actions</p>
          </div>
        </Link>
      </div>

      {/* Recent Platform Activity */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Recent Super Admin Activity</h2>
            <p className="text-xs text-slate-400">Platform operations recorded in platform_audit_log</p>
          </div>
          <Link to="/admin/audit-logs" className="text-xs text-purple-400 hover:text-purple-300 font-medium">
            View All Logs →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">Target Name</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {(!data?.recent_activity || data.recent_activity.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No platform governance actions recorded yet.
                  </td>
                </tr>
              ) : (
                data.recent_activity.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-400">{log.target_type}</td>
                    <td className="py-3 px-4 font-medium text-white">{log.target_name || `#${log.target_id || "-"}`}</td>
                    <td className="py-3 px-4 text-slate-400">{log.super_admin_email}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{log.ip_address || "127.0.0.1"}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
