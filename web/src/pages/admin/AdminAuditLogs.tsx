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
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Audit Log</h1>
          <p className="text-sm text-slate-400">
            Immutable system audit trail recording every administrative governance operation
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search action, target, actor..."
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-64"
          />
          <button
            onClick={() => loadLogs(page)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
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
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No platform audit logs match the query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-500">{log.id}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-300">{log.target_type}</td>
                    <td className="py-3 px-4 font-medium text-white">
                      {log.target_name || (log.target_id ? `#${log.target_id}` : "-")}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{log.super_admin_email}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{log.ip_address || "127.0.0.1"}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition"
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
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{filteredLogs.length}</strong> of{" "}
            <strong className="text-white">{total}</strong> total log entries
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="px-2 text-white">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* INSPECT LOG DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-purple-400 font-bold">{selectedLog.action}</span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">Log #{selectedLog.id}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Target Entity</span>
                <span className="font-semibold text-white capitalize">{selectedLog.target_type}</span>
                <span className="text-slate-400 block truncate">{selectedLog.target_name || `#${selectedLog.target_id || "-"}`}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Actor & IP</span>
                <span className="font-semibold text-white">{selectedLog.super_admin_email}</span>
                <span className="text-slate-400 font-mono block">{selectedLog.ip_address || "127.0.0.1"}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-1">Payload / Details JSON</span>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto max-h-64">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="text-[11px] text-slate-400">
              Recorded at: {new Date(selectedLog.created_at).toISOString()} ({new Date(selectedLog.created_at).toLocaleString()})
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
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
