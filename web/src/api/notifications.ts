import { api } from "./client";

export interface AppNotification {
  id: number;
  owner_id: number;
  shop_id?: number | null;
  recipient_type: "owner" | "employee" | "customer";
  recipient_id: number;
  type: string;
  title: string;
  message: string;
  reference_type?: string | null;
  reference_id?: number | null;
  is_read: boolean;
  created_at: string;
}

export async function listNotificationsApi(unreadOnly = false, limit = 50) {
  const res = await api.get<{
    success: boolean;
    data: { notifications: AppNotification[]; unreadCount: number };
  }>("/notifications", { params: { unreadOnly, limit } });
  return res.data.data;
}

export async function getUnreadCountApi() {
  const res = await api.get<{
    success: boolean;
    data: { unreadCount: number };
  }>("/notifications/unread-count");
  return res.data.data?.unreadCount || 0;
}

export async function markNotificationReadApi(id: number) {
  const res = await api.post<{ success: boolean; data: AppNotification }>(
    `/notifications/${id}/read`
  );
  return res.data;
}

export async function markAllNotificationsReadApi() {
  const res = await api.post<{ success: boolean; message: string }>(
    "/notifications/read-all"
  );
  return res.data;
}

export async function getAlertsApi() {
  const res = await api.get<{
    success: boolean;
    data: {
      lowStock: any[];
      overdueEmi: any[];
      pendingLeaves: any[];
    };
  }>("/notifications/alerts");
  return res.data.data;
}

