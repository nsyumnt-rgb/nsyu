import { api } from "./client";

export type ChannelSel = "whatsapp" | "email" | "both";
export type DeliveryStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "skipped" | "cancelled";

export interface Readiness {
  whatsapp: { ready: boolean; reason?: string };
  email: { ready: boolean; reason?: string };
}

export interface AutomationRule {
  whatsapp: boolean;
  email: boolean;
  templateId?: number | null;
  days?: number;
}

export interface MessagingSettings {
  whatsapp: {
    enabled: boolean;
    phoneNumberId: string;
    businessAccountId: string;
    displayNumber: string;
    apiVersion: string;
    accessTokenSet: boolean;
    accessTokenHint: string | null;
    appSecretSet: boolean;
    verifyToken: string;
    webhookUrl: string;
  };
  email: { enabled: boolean; senderName: string; senderAddress: string; replyTo: string };
  automations: Record<string, AutomationRule>;
  legacyEmailEvents: string[];
  festivals: { name: string; date: string }[];
  creditDays: number;
  readiness?: Readiness;
}

export interface MessageTemplate {
  id: number;
  name: string;
  category: string;
  message_type: "transactional" | "promotional";
  whatsapp_body: string | null;
  wa_template_name: string | null;
  wa_template_language: string | null;
  wa_template_params: string[] | null;
  email_subject: string | null;
  email_html: string | null;
  attachments: { name: string; url: string }[] | null;
  is_active: boolean;
  updated_at: string;
}

export interface Recipient {
  id: number;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  dueAmount: number;
  willReceive: { whatsapp: boolean; email: boolean };
  preferences?: { allowWhatsapp: boolean; allowEmail: boolean; promoWhatsapp: boolean; promoEmail: boolean };
}

export interface AudienceFilters {
  search?: string;
  customerType?: "" | "business" | "individual" | "portal" | "walk_in";
  location?: string;
  dues?: "" | "with_dues" | "no_dues";
  minDue?: number | null;
  purchasedWithinDays?: number | null;
  notPurchasedWithinDays?: number | null;
  neverPurchased?: boolean;
  minTotalSpent?: number | null;
  categoryId?: number | null;
  thisShopOnly?: boolean;
}

export type Audience = { mode: "selected"; customerIds: number[] } | { mode: "filter"; filters: AudienceFilters; excludeIds?: number[] };

export interface HistoryItem {
  id: number | string;
  source: "messaging" | "system_email";
  campaignId: number | null;
  customerId: number | null;
  customerName: string | null;
  channel: "whatsapp" | "email";
  recipient: string | null;
  messageType: string;
  eventType: string | null;
  templateName: string | null;
  subject: string | null;
  body: string | null;
  status: DeliveryStatus;
  failureReason: string | null;
  attempts: number;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  groupKey: string;
  log: { at: string; event: string; detail?: string }[];
}

export interface Campaign {
  id: number;
  kind: "single" | "group" | "automation";
  title: string | null;
  message_type: string;
  channels: ChannelSel;
  status: string;
  scheduled_at: string | null;
  next_run_at: string | null;
  recurrence: { every: string; interval: number; until?: string | null } | null;
  run_count: number;
  created_at: string;
  template?: { id: number; name: string } | null;
  stats: Record<string, number>;
  deliveries?: HistoryItem[];
}

const d = <T,>(p: Promise<{ data: { data: T; message?: string } }>) => p.then((r) => r.data.data);

export const messagingApi = {
  overview: () => d<{ readiness: Readiness; counts: Record<string, Record<string, number>>; scheduled: number; settings: MessagingSettings; variables: { key: string; label: string }[] }>(api.get("/messaging/overview")),
  settings: () => d<MessagingSettings>(api.get("/messaging/settings")),
  saveWhatsApp: (body: any) => api.put("/messaging/settings/whatsapp", body).then((r) => r.data),
  verifyWhatsApp: () => api.post("/messaging/settings/whatsapp/verify").then((r) => r.data),
  waTemplates: () => d<{ name: string; language: string; status: string; category: string; body: string; paramCount: number }[]>(api.get("/messaging/settings/whatsapp/templates")),
  saveEmail: (body: any) => api.put("/messaging/settings/email", body).then((r) => r.data),
  testEmail: (to: string) => api.post("/messaging/settings/email/test", { to }).then((r) => r.data),
  saveAutomations: (body: any) => api.put("/messaging/automations", body).then((r) => r.data),

  templates: () => d<MessageTemplate[]>(api.get("/messaging/templates")),
  createTemplate: (body: any) => api.post("/messaging/templates", body).then((r) => r.data),
  updateTemplate: (id: number, body: any) => api.put(`/messaging/templates/${id}`, body).then((r) => r.data),
  deleteTemplate: (id: number) => api.delete(`/messaging/templates/${id}`).then((r) => r.data),
  uploadAttachment: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return d<{ name: string; url: string }>(api.post("/messaging/attachments", fd));
  },

  customers: (search: string, ids?: number[]) => d<Recipient[]>(api.get("/messaging/customers", { params: { search, limit: 40, ids: ids?.join(",") || undefined } })),
  audience: (audience: Audience, channels: ChannelSel, messageType: string) =>
    d<{ total: number; reachable: number; whatsapp: number; email: number; readiness: Readiness; recipients: Recipient[]; truncated: boolean }>(
      api.post("/messaging/audience/preview", { audience, channels, messageType })
    ),
  preview: (body: any) =>
    d<{ customer: any; whatsapp: { text: string; approvedTemplate: { name: string; language: string; params: string[] } | null }; email: { subject: string; html: string }; attachments: any[] }>(
      api.post("/messaging/preview", body)
    ),
  send: (body: any) => api.post("/messaging/send", body).then((r) => r.data as { success: boolean; message: string; data: { campaign: Campaign } }),

  campaigns: () => d<Campaign[]>(api.get("/messaging/campaigns")),
  campaign: (id: number) => d<Campaign & { deliveries: HistoryItem[] }>(api.get(`/messaging/campaigns/${id}`)),
  cancelCampaign: (id: number) => api.post(`/messaging/campaigns/${id}/cancel`).then((r) => r.data),
  history: (params: Record<string, any>) =>
    api.get("/messaging/history", { params }).then((r) => r.data as { data: HistoryItem[]; pagination: { page: number; pages: number; total: number; limit: number } }),
  retry: (id: number | string) => api.post(`/messaging/deliveries/${id}/retry`).then((r) => r.data),

  customerPrefs: (customerId: number) => d<CustomerPrefs>(api.get(`/messaging/customers/${customerId}/preferences`)),
  saveCustomerPrefs: (customerId: number, body: Partial<CustomerPrefs>) => api.put(`/messaging/customers/${customerId}/preferences`, body).then((r) => r.data),
};

/** Unsubscribe / preference link (no sign-in; the token in the link is the key). */
export const publicPrefsApi = {
  get: (token: string) => d<CustomerPrefs & { firstName: string; shopName: string }>(api.get(`/messaging/public/preferences/${token}`)),
  save: (token: string, body: Partial<CustomerPrefs> & { unsubscribeAll?: boolean }) =>
    api.put(`/messaging/public/preferences/${token}`, body).then((r) => r.data as { message: string; data: CustomerPrefs }),
};

export interface CustomerPrefs {
  allowWhatsapp: boolean;
  allowEmail: boolean;
  promoWhatsapp: boolean;
  promoEmail: boolean;
  whatsappNumber: string;
  dateOfBirth: string;
  optedOutAt?: string | null;
}

export const AUTOMATION_LABELS: Record<string, { label: string; hint: string; promo?: boolean }> = {
  customer_registration: { label: "Customer registration", hint: "When a customer is added or signs up" },
  order_confirmed: { label: "Order confirmed", hint: "When an order moves to Confirmed" },
  order_dispatched: { label: "Order dispatched", hint: "When an order moves to Shipped" },
  order_delivered: { label: "Order delivered", hint: "When an order moves to Delivered" },
  invoice_generated: { label: "Invoice generated", hint: "When a bill is created" },
  payment_received: { label: "Payment received", hint: "When a payment is recorded" },
  pending_payment: { label: "Pending payment", hint: "Repeats while a customer has dues" },
  due_date_reminder: { label: "Due date reminder", hint: "Before and on the invoice due date" },
  offers_promotions: { label: "New offers", hint: "When a product's price drops", promo: true },
  birthday_greeting: { label: "Birthday greeting", hint: "On the customer's birthday", promo: true },
  festival_greeting: { label: "Festival greeting", hint: "On festival dates you add", promo: true },
};

export const STATUS_STYLE: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600 ring-slate-500/10",
  sending: "bg-slate-100 text-slate-600 ring-slate-500/10",
  sent: "bg-sky-50 text-sky-700 ring-sky-600/15",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  read: "bg-brand-50 text-brand-800 ring-brand-600/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/15",
  skipped: "bg-amber-50 text-amber-800 ring-amber-600/20",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-500/10",
};
