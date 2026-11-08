import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listPortalNotificationsApi,
  markPortalNotificationReadApi,
  markAllPortalNotificationsReadApi,
} from "../../api/portal";
import { usePortalStore } from "../../store/portalStore";

export default function PortalNotifications() {
  const setUnreadCount = usePortalStore((s) => s.setUnreadCount);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await listPortalNotificationsApi({ unread: unreadOnly ? true : undefined });
      const items = res?.data || [];
      setNotifications(items);
      const unread = items.filter((n: any) => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  const handleMarkRead = async (id: number) => {
    try {
      await markPortalNotificationReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(Math.max(0, notifications.filter((n) => !n.is_read && n.id !== id).length));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllPortalNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Notifications</h1>
          <p className="text-xs text-gray-500 mt-0.5">Stay updated on order statuses, invoices, and shop notices.</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <span>Unread only</span>
          </label>

          <button
            type="button"
            onClick={handleMarkAllRead}
            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs transition"
          >
            Mark All Read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 mt-2 font-medium">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
            <BellIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-800">No notifications</h3>
          <p className="text-xs text-gray-500 mt-1">You are all caught up with your updates.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const link =
              n.entity_type === "order"
                ? `/portal/orders/${n.entity_id}`
                : n.entity_type === "sale" || n.entity_type === "bill"
                ? `/portal/bills/${n.entity_id}`
                : null;

            return (
              <div
                key={n.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition flex items-start gap-4 ${
                  !n.is_read
                    ? "border-emerald-300 bg-emerald-50/20 shadow-sm"
                    : "border-gray-100 text-gray-600"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    !n.is_read ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <BellIcon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm ${!n.is_read ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                      {n.title}
                    </h3>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message}</p>

                  <div className="mt-3 flex items-center gap-3">
                    {link && (
                      <Link
                        to={link}
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        View Details &rarr;
                      </Link>
                    )}
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

