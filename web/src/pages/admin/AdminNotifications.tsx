import { useEffect, useState } from "react";
import {
  fetchAdminNotifications,
  broadcastAdminNotification,
  fetchAdminOwners,
  type AdminNotificationItem,
  type AdminOwnerItem,
} from "../../api/admin";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [owners, setOwners] = useState<AdminOwnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [targetAudience, setTargetAudience] = useState<
    "all_owners" | "all_employees" | "all_customers" | "specific_owner"
  >("all_owners");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | "">("");
  const [notificationType, setNotificationType] = useState("system_announcement");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  // Filter & Search
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [notifsRes, ownersRes] = await Promise.all([
        fetchAdminNotifications(),
        fetchAdminOwners(),
      ]);
      setNotifications(notifsRes.data?.data || []);
      setOwners(ownersRes.data?.data || []);
      if (ownersRes.data?.data && ownersRes.data.data.length > 0 && selectedOwnerId === "") {
        setSelectedOwnerId(ownersRes.data.data[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError("Please provide both a Title and Message for the notification.");
      return;
    }
    if (targetAudience === "specific_owner" && !selectedOwnerId) {
      setError("Please select a specific shop owner.");
      return;
    }

    setSending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await broadcastAdminNotification({
        target_audience: targetAudience,
        owner_id: targetAudience === "specific_owner" ? Number(selectedOwnerId) : undefined,
        title: title.trim(),
        message: message.trim(),
        type: notificationType,
      });

      const count = res.data?.data?.count ?? 1;
      setSuccessMsg(`Successfully broadcasted alert to ${count} recipient(s).`);
      setTitle("");
      setMessage("");
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to send notification broadcast.");
    } finally {
      setSending(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType !== "all" && n.recipient_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">
              Platform Communications
            </span>
          </div>
          <h1 className="page-title">Platform Notifications</h1>
          <p className="page-subtitle">
            Broadcast platform-wide alerts, system maintenance notes, and targeted notices to tenant owners and users
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn-secondary btn-sm flex items-center space-x-2 text-xs font-bold self-start sm:self-auto"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Broadcast Composer Card */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-navy-900">Broadcast Alert to Platform Users</h2>
            <p className="text-xs text-slate-500">Delivered directly to in-app notification centers and user dashboards</p>
          </div>
        </div>

        <form onSubmit={handleBroadcast} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Target Audience *</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as any)}
                className="input h-10 text-xs bg-white font-medium"
              >
                <option value="all_owners">📢 All Shop Owners</option>
                <option value="all_employees">👥 All Staff / Employees</option>
                <option value="all_customers">🛍️ All Registered Customers</option>
                <option value="specific_owner">🎯 Specific Shop Owner</option>
              </select>
            </div>

            {targetAudience === "specific_owner" && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Shop Owner *</label>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(Number(e.target.value))}
                  className="input h-10 text-xs bg-white font-medium"
                >
                  <option value="">Select an Owner</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold mb-1">Notification Type *</label>
              <select
                value={notificationType}
                onChange={(e) => setNotificationType(e.target.value)}
                className="input h-10 text-xs bg-white font-medium"
              >
                <option value="system_announcement">System Announcement</option>
                <option value="platform_update">Platform Feature Update</option>
                <option value="maintenance_alert">Scheduled Maintenance</option>
                <option value="security_notice">Security / Compliance Alert</option>
                <option value="payment_reminder">Billing / Subscription Alert</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Broadcast Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled System Upgrade: Sunday 2 AM to 4 AM IST"
              className="input h-10 text-xs bg-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Broadcast Message Content *</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter full notice, detailed instructions, or release notes..."
              className="input text-xs bg-white py-2"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={sending}
              className="btn-primary text-xs font-bold px-5 py-2.5 shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Dispatching Broadcast...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Dispatch Platform Broadcast</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Notifications History */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-navy-900">Broadcast & Notification History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Immutable record of alerts dispatched across the platform</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
              {[
                { key: "all", label: "All" },
                { key: "owner", label: "Owners" },
                { key: "employee", label: "Staff" },
                { key: "customer", label: "Customers" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterType(f.key)}
                  className={`px-2.5 py-1 rounded-lg transition font-semibold ${
                    filterType === f.key
                      ? "bg-white text-navy-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="input h-9 text-xs w-48 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Title & Message</th>
                <th className="py-3 px-4">Recipient Audience</th>
                <th className="py-3 px-4">Category Type</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading notification logs...
                  </td>
                </tr>
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No platform notifications found.
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notif) => (
                  <tr key={notif.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 tabular text-slate-400 font-semibold">{notif.id}</td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-bold text-navy-900 text-xs">{notif.title}</div>
                      <div className="text-[11.5px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.message}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-800 capitalize border border-slate-200">
                        {notif.recipient_type} #{notif.recipient_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {notif.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(notif.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          notif.is_read
                            ? "bg-slate-50 text-slate-600 border-slate-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {notif.is_read ? "Read" : "Delivered"}
                      </span>
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
