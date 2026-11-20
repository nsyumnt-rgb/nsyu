import { useEffect, useState } from "react";
import { fetchAdminAuditLogs, type PlatformAuditLogEntry } from "../../api/admin";

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<PlatformAuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState<PlatformAuditLogEntry | null>(null);

  // Filter / Search
  const [filterQuery, setFilterQuery] = useState("");

  const loadLogs = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAuditLogs(p, limit);
      if (res.data?.data) {
        setLogs(res.data.data.logs);
        setTotal(res.data.data.total);
        setPage(res.data.data.page);
        setTotalPages(res.data.data.totalPages || 1);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(page);
  }, [page]);

  const filteredLogs = logs.filter((log) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.target_type.toLowerCase().includes(q) ||
      (log.target_name && log.target_name.toLowerCase().includes(q)) ||
      log.super_admin_email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Platform Compliance
            </span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">Platform Audit Log</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Immutable system audit trail recording every administrative governance operation
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search action, target, actor..."
            className="input h-10 text-xs w-64 bg-white"
          />
          <button
            onClick={() => loadLogs(page)}
            className="btn-secondary btn-sm flex items-center space-x-2 text-xs font-bold"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">Target Name / ID</th>
                <th className="py-3 px-4">Super Admin</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No platform audit logs match the query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">{log.id}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-500 font-medium">{log.target_type}</td>
                    <td className="py-3.5 px-4 font-bold text-navy-900">
                      {log.target_name || (log.target_id ? `#${log.target_id}` : "-")}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{log.super_admin_email}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{log.ip_address || "127.0.0.1"}</td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-[#E5E7EB] shadow-2xs transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing <strong className="text-navy-900">{filteredLogs.length}</strong> of{" "}
            <strong className="text-navy-900">{total}</strong> total log entries
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-secondary btn-sm text-xs font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-bold text-navy-900">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn-secondary btn-sm text-xs font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* INSPECT LOG DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{selectedLog.action}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-bold text-slate-500">Log #{selectedLog.id}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-400 block font-medium">Target Entity</span>
                <span className="font-bold text-navy-900 capitalize">{selectedLog.target_type}</span>
                <span className="text-slate-500 block truncate mt-0.5">{selectedLog.target_name || `#${selectedLog.target_id || "-"}`}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-400 block font-medium">Actor & IP</span>
                <span className="font-bold text-navy-900">{selectedLog.super_admin_email}</span>
                <span className="text-slate-500 font-mono block mt-0.5">{selectedLog.ip_address || "127.0.0.1"}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1">Payload / Details JSON</span>
              <pre className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 overflow-x-auto max-h-64 leading-relaxed">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="text-[11px] text-slate-400 font-medium">
              Recorded at: {new Date(selectedLog.created_at).toISOString()} ({new Date(selectedLog.created_at).toLocaleString()})
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn-secondary btn-sm text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
