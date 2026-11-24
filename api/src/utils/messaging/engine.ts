import crypto from "crypto";
import { Op, QueryTypes, UniqueConstraintError } from "sequelize";
import { sequelize, Customer, CustomerAccount, Shop } from "../../models";
import {
  MessagingSettings,
  MessageTemplate,
  MessageCampaign,
  MessageDelivery,
  CustomerMessagePreference,
  PROMOTIONAL_EVENTS,
  type AutomationEvent,
  type ChannelSelection,
  type MessageChannel,
} from "../../models/Messaging";
import { getTransporterForShop, isEmailConfigured } from "../mailer";
import { decryptSecret } from "./secrets";
import { renderHtml, renderText, wrapEmail, htmlToText, type TemplateVars } from "./render";
import { getSettingsRow, resolveRules, LEGACY_EMAIL_EVENTS } from "./settings";
import {
  normalizeWhatsAppNumber,
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  type WhatsAppCredentials,
} from "./whatsapp";

export const WEB_URL = () => (process.env.PUBLIC_WEB_URL || "https://nsyu.in").replace(/\/+$/, "");
const DAY = 86400000;
const WA_WINDOW_MS = 24 * 3600 * 1000;

export const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const channelsOf = (sel: ChannelSelection | string): MessageChannel[] =>
  sel === "both" ? ["whatsapp", "email"] : sel === "whatsapp" ? ["whatsapp"] : sel === "email" ? ["email"] : [];

/* ------------------------------------------------------------------ */
/* Channel readiness                                                   */
/* ------------------------------------------------------------------ */

export function whatsappCredentials(row?: MessagingSettings | null): WhatsAppCredentials | null {
  if (!row?.wa_phone_number_id) return null;
  const token = decryptSecret(row.wa_access_token_enc);
  if (!token) return null;
  return {
    phoneNumberId: row.wa_phone_number_id,
    accessToken: token,
    businessAccountId: row.wa_business_account_id,
    apiVersion: row.wa_api_version,
  };
}

export interface ChannelReadiness {
  whatsapp: { ready: boolean; reason?: string };
  email: { ready: boolean; reason?: string };
}

export async function channelReadiness(shopId: number, row?: MessagingSettings | null): Promise<ChannelReadiness> {
  const settings = row === undefined ? await getSettingsRow(shopId) : row;
  const wa = !settings?.whatsapp_enabled
    ? { ready: false, reason: "WhatsApp messaging is turned off for this shop" }
    : !whatsappCredentials(settings)
    ? { ready: false, reason: "WhatsApp Business Cloud API is not connected" }
    : { ready: true };
  const emailOn = settings ? settings.email_enabled !== false : true;
  const smtp = emailOn ? await isEmailConfigured(shopId) : false;
  const email = !emailOn
    ? { ready: false, reason: "Email messaging is turned off for this shop" }
    : !smtp
    ? { ready: false, reason: "Gmail/SMTP is not configured" }
    : { ready: true };
  return { whatsapp: wa, email };
}

/* ------------------------------------------------------------------ */
/* Customers, contacts, preferences                                    */
/* ------------------------------------------------------------------ */

export async function getPreference(ownerId: number, customerId: number, create = true) {
  let pref = await CustomerMessagePreference.findOne({ where: { owner_id: ownerId, customer_id: customerId } });
  if (!pref && create) {
    try {
      pref = await CustomerMessagePreference.create({
        owner_id: ownerId,
        customer_id: customerId,
        unsubscribe_token: crypto.randomBytes(24).toString("hex"),
      });
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        pref = await CustomerMessagePreference.findOne({ where: { owner_id: ownerId, customer_id: customerId } });
      } else throw err;
    }
  }
  return pref;
}

export function contactOf(customer: any, pref?: CustomerMessagePreference | null) {
  const email = String(customer?.email || customer?.account?.email || "").trim();
  const phone = pref?.whatsapp_number || customer?.phone || customer?.account?.phone || null;
  return {
    email: email.includes("@") ? email : null,
    whatsapp: normalizeWhatsAppNumber(phone),
  };
}

export function unsubscribeUrl(pref?: CustomerMessagePreference | null) {
  return pref ? `${WEB_URL()}/#/preferences/${pref.unsubscribe_token}` : null;
}

async function shopInfo(shopId: number) {
  const shop = await Shop.findByPk(shopId);
  return { name: shop?.name || "Our shop", settings: (shop?.settings || {}) as any };
}

/** Variables every message can use; event-specific ones are merged on top. */
export function baseVars(customer: any, shop: { name: string; settings: any }, pref?: CustomerMessagePreference | null): TemplateVars {
  const due = Math.max(0, Number(customer?.current_balance || 0));
  const upi = String(shop.settings?.upiId || "").trim();
  const paymentLink = upi
    ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(shop.name)}${due > 0 ? `&am=${due.toFixed(2)}` : ""}&cu=INR`
    : `${WEB_URL()}/#/portal/ledger`;
  return {
    customer_name: customer?.name || "Customer",
    shop_name: shop.name,
    due_amount: inr(due),
    payment_link: paymentLink,
    unsubscribe_link: unsubscribeUrl(pref) || "",
  };
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export interface MessageContent {
  whatsappBody?: string | null;
  /** Approved WhatsApp template; params are strings that may contain {{variables}} */
  waTemplate?: { name: string; language: string; params: string[] } | null;
  emailSubject?: string | null;
  emailHtml?: string | null;
  attachments?: Array<{ name: string; url: string }> | null;
}

export function contentFromTemplate(t: MessageTemplate): MessageContent {
  return {
    whatsappBody: t.whatsapp_body,
    waTemplate: t.wa_template_name
      ? { name: t.wa_template_name, language: t.wa_template_language || "en", params: (t.wa_template_params || []) as string[] }
      : null,
    emailSubject: t.email_subject,
    emailHtml: t.email_html,
    attachments: t.attachments || [],
  };
}

/** Built-in wording for automations that have no custom template selected. */
export const DEFAULT_EVENT_CONTENT: Record<AutomationEvent, MessageContent> = {
  customer_registration: {
    whatsappBody: "Hi {{customer_name}}, welcome to {{shop_name}}! You can now order, see your bills and track deliveries online.",
    emailSubject: "Welcome to {{shop_name}}",
    emailHtml: "Hi {{customer_name}},\n\nWelcome to {{shop_name}}! You can now order, see your bills and track deliveries online.\n\nThank you for choosing us.",
  },
  order_confirmed: {
    whatsappBody: "Hi {{customer_name}}, your order {{order_number}} for {{order_amount}} is confirmed by {{shop_name}}. Track it here: {{order_tracking_link}}",
    emailSubject: "Order {{order_number}} confirmed",
    emailHtml: "Hi {{customer_name}},\n\nYour order {{order_number}} for {{order_amount}} has been confirmed.\n\nTrack your order: {{order_tracking_link}}",
  },
  order_dispatched: {
    whatsappBody: "Hi {{customer_name}}, your order {{order_number}} from {{shop_name}} is on the way. Track it: {{order_tracking_link}}",
    emailSubject: "Order {{order_number}} dispatched",
    emailHtml: "Hi {{customer_name}},\n\nGood news — your order {{order_number}} has been dispatched.\n\nTrack your order: {{order_tracking_link}}",
  },
  order_delivered: {
    whatsappBody: "Hi {{customer_name}}, your order {{order_number}} from {{shop_name}} has been delivered. Thank you for shopping with us!",
    emailSubject: "Order {{order_number}} delivered",
    emailHtml: "Hi {{customer_name}},\n\nYour order {{order_number}} has been delivered. Thank you for shopping with {{shop_name}}!\n\nOrder details: {{order_tracking_link}}",
  },
  payment_received: {
    whatsappBody: "Hi {{customer_name}}, we received your payment of {{payment_amount}}. Outstanding balance: {{due_amount}}. Thank you! — {{shop_name}}",
    emailSubject: "Payment received: {{payment_amount}}",
    emailHtml: "Hi {{customer_name}},\n\nWe have received your payment of {{payment_amount}}.\n\nYour outstanding balance is now {{due_amount}}.\n\nThank you!",
  },
  pending_payment: {
    whatsappBody: "Hi {{customer_name}}, a friendly reminder that {{due_amount}} is pending with {{shop_name}}. Pay here: {{payment_link}}",
    emailSubject: "Payment reminder from {{shop_name}}",
    emailHtml: "Hi {{customer_name}},\n\nThis is a friendly reminder that {{due_amount}} is pending on your account.\n\nPay here: {{payment_link}}\n\nIf you have already paid, please ignore this message.",
  },
  due_date_reminder: {
    whatsappBody: "Hi {{customer_name}}, invoice {{order_number}} ({{due_amount}} due) is due on {{due_date}}. Pay here: {{payment_link}} — {{shop_name}}",
    emailSubject: "Invoice {{order_number}} is due on {{due_date}}",
    emailHtml: "Hi {{customer_name}},\n\nInvoice {{order_number}} has {{due_amount}} due on {{due_date}}.\n\nView invoice: {{invoice_link}}\nPay here: {{payment_link}}",
  },
  invoice_generated: {
    whatsappBody: "Hi {{customer_name}}, your invoice {{order_number}} for {{order_amount}} from {{shop_name}} is ready. Due: {{due_amount}}. View: {{invoice_link}}",
    emailSubject: "Invoice {{order_number}} from {{shop_name}}",
    emailHtml: "Hi {{customer_name}},\n\nYour invoice {{order_number}} for {{order_amount}} is ready.\n\nAmount due: {{due_amount}}\n\nView invoice: {{invoice_link}}",
  },
  offers_promotions: {
    whatsappBody: "Hi {{customer_name}}, new offer at {{shop_name}}: {{product_name}}. Shop now: {{order_tracking_link}}",
    emailSubject: "New offer at {{shop_name}}: {{product_name}}",
    emailHtml: "Hi {{customer_name}},\n\nWe have a new offer for you: {{product_name}}.\n\nShop now: {{order_tracking_link}}",
  },
  birthday_greeting: {
    whatsappBody: "Happy birthday, {{customer_name}}! 🎉 Warm wishes from all of us at {{shop_name}}.",
    emailSubject: "Happy birthday, {{customer_name}}!",
    emailHtml: "Dear {{customer_name}},\n\nHappy birthday! Warm wishes from all of us at {{shop_name}}.",
  },
  festival_greeting: {
    whatsappBody: "Happy {{festival_name}}, {{customer_name}}! Warm wishes from {{shop_name}}.",
    emailSubject: "Happy {{festival_name}} from {{shop_name}}",
    emailHtml: "Dear {{customer_name}},\n\nWishing you and your family a very happy {{festival_name}}!\n\nWarm wishes,\n{{shop_name}}",
  },
};

/* ------------------------------------------------------------------ */
/* Enqueue                                                             */
/* ------------------------------------------------------------------ */

export interface EnqueueParams {
  ownerId: number;
  shopId: number;
  customerId: number;
  channels: MessageChannel[];
  messageType: "transactional" | "promotional";
  content: MessageContent;
  vars?: TemplateVars;
  campaignId?: number | null;
  templateId?: number | null;
  eventType?: string | null;
  /** Same key → no second message (per shop, per channel) */
  dedupeKey?: string | null;
  reference?: { type: string; id: number } | null;
  sendAt?: Date | null;
  /** Pre-loaded for bulk sends */
  ctx?: { settings: MessagingSettings | null; readiness: ChannelReadiness; shop: { name: string; settings: any } };
}

function logEntry(event: string, detail?: string) {
  return { at: new Date().toISOString(), event, ...(detail ? { detail } : {}) };
}

/**
 * Creates one delivery row per channel for one customer. Every rule that stops a message
 * (channel off, no contact, customer preference, promotional opt-out, duplicate) is recorded
 * as a "skipped" row with the reason, so the sender can see exactly why.
 */
export async function enqueueForCustomer(p: EnqueueParams): Promise<MessageDelivery[]> {
  const customer: any = await Customer.findOne({
    where: { id: p.customerId, owner_id: p.ownerId },
    include: [{ model: CustomerAccount, as: "account", required: false }],
  });
  if (!customer) return [];

  const settings = p.ctx ? p.ctx.settings : await getSettingsRow(p.shopId);
  const readiness = p.ctx ? p.ctx.readiness : await channelReadiness(p.shopId, settings);
  const shop = p.ctx ? p.ctx.shop : await shopInfo(p.shopId);
  const pref = await getPreference(p.ownerId, customer.id);
  const contact = contactOf(customer, pref);
  const vars: TemplateVars = { ...baseVars(customer, shop, pref), ...(p.vars || {}) };
  const promotional = p.messageType === "promotional";

  const out: MessageDelivery[] = [];
  for (const channel of p.channels) {
    const dedupe = p.dedupeKey ? `${p.dedupeKey}:${channel}` : null;
    if (dedupe) {
      const existing = await MessageDelivery.findOne({ where: { shop_id: p.shopId, dedupe_key: dedupe } });
      if (existing) {
        out.push(existing);
        continue;
      }
    }

    let skip: string | null = null;
    if (channel === "whatsapp") {
      if (!readiness.whatsapp.ready) skip = readiness.whatsapp.reason!;
      else if (!contact.whatsapp) skip = "No valid WhatsApp number on file";
      else if (pref && !pref.allow_whatsapp) skip = "Customer chose not to receive WhatsApp messages";
      else if (promotional && pref && !pref.promo_whatsapp) skip = "Customer opted out of promotional WhatsApp messages";
      else if (!p.content.waTemplate && !p.content.whatsappBody) skip = "No WhatsApp content in this message";
    } else {
      if (!readiness.email.ready) skip = readiness.email.reason!;
      else if (!contact.email) skip = "No email address on file";
      else if (pref && !pref.allow_email) skip = "Customer chose not to receive emails";
      else if (promotional && pref && !pref.promo_email) skip = "Customer unsubscribed from promotional emails";
      else if (!p.content.emailHtml) skip = "No email content in this message";
    }

    const row: any = {
      owner_id: p.ownerId,
      shop_id: p.shopId,
      campaign_id: p.campaignId || null,
      customer_id: customer.id,
      channel,
      recipient: channel === "whatsapp" ? contact.whatsapp : contact.email,
      recipient_name: customer.name,
      message_type: p.messageType,
      event_type: p.eventType || null,
      template_id: p.templateId || null,
      attachments: (p.content.attachments || []).filter((a) => /^https?:\/\//i.test(a.url)),
      dedupe_key: dedupe,
      reference_type: p.reference?.type || null,
      reference_id: p.reference?.id || null,
      status: skip ? "skipped" : "queued",
      failure_reason: skip,
      next_attempt_at: skip ? null : p.sendAt || new Date(),
      log: [logEntry(skip ? "skipped" : "queued", skip || undefined)],
    };

    if (channel === "whatsapp") {
      row.body = p.content.waTemplate
        ? renderText(p.content.whatsappBody || `[WhatsApp template: ${p.content.waTemplate.name}]`, vars)
        : renderText(p.content.whatsappBody, vars);
      row.wa_template = p.content.waTemplate
        ? { ...p.content.waTemplate, params: p.content.waTemplate.params.map((x) => renderText(x, vars)) }
        : null;
    } else {
      const subject = renderText(p.content.emailSubject || `Message from ${shop.name}`, vars).slice(0, 250);
      const bodyHtml = renderHtml(p.content.emailHtml, vars);
      row.subject = subject;
      row.html = wrapEmail({ shopName: shop.name, bodyHtml, unsubscribeUrl: unsubscribeUrl(pref), promotional });
      row.body = htmlToText(bodyHtml);
    }

    try {
      out.push(await MessageDelivery.create(row));
    } catch (err) {
      if (err instanceof UniqueConstraintError && dedupe) {
        const existing = await MessageDelivery.findOne({ where: { shop_id: p.shopId, dedupe_key: dedupe } });
        if (existing) out.push(existing);
      } else throw err;
    }
  }
  if (out.some((d) => d.status === "queued")) kickQueue();
  return out;
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

async function finish(d: MessageDelivery, res: { ok: boolean; messageId?: string; error?: string; permanent?: boolean }) {
  const log = [...((d.log as any[]) || [])];
  if (res.ok) {
    log.push(logEntry("sent", res.messageId));
    await d.update({ status: "sent", provider_message_id: res.messageId || null, sent_at: new Date(), failure_reason: null, log });
    return;
  }
  const attempts = d.attempts; // already incremented on claim
  const retry = !res.permanent && attempts < d.max_attempts;
  log.push(logEntry(retry ? "retry_scheduled" : "failed", res.error));
  await d.update({
    status: retry ? "queued" : "failed",
    failure_reason: res.error || "Unknown error",
    next_attempt_at: retry ? new Date(Date.now() + Math.pow(2, attempts) * 60000) : null,
    log,
  });
}

export async function sendDelivery(d: MessageDelivery): Promise<void> {
  // Claim atomically so two workers never send the same message
  const [claimed] = await MessageDelivery.update(
    { status: "sending", attempts: d.attempts + 1 },
    { where: { id: d.id, status: "queued" } }
  );
  if (!claimed) return;
  await d.reload();

  const settings = await getSettingsRow(d.shop_id);
  const readiness = await channelReadiness(d.shop_id, settings);

  if (d.channel === "whatsapp") {
    if (!readiness.whatsapp.ready) return finish(d, { ok: false, error: readiness.whatsapp.reason, permanent: true });
    const creds = whatsappCredentials(settings)!;
    if (d.wa_template) {
      return finish(d, await sendWhatsAppTemplate(creds, d.recipient!, d.wa_template));
    }
    // Free-form text is only allowed inside the 24-hour customer service window (WhatsApp policy)
    const pref = d.customer_id ? await getPreference(d.owner_id, d.customer_id, false) : null;
    const inWindow = !!pref?.last_inbound_at && Date.now() - new Date(pref.last_inbound_at).getTime() < WA_WINDOW_MS;
    if (!inWindow) {
      return finish(d, {
        ok: false,
        permanent: true,
        error:
          "Outside WhatsApp's 24-hour customer service window — free-form text is not allowed. Choose a template linked to an approved WhatsApp template.",
      });
    }
    const res = await sendWhatsAppText(creds, d.recipient!, d.body || "");
    if (res.ok) {
      for (const a of (d.attachments as any[]) || []) {
        await sendWhatsAppDocument(creds, d.recipient!, a.url, a.name || "attachment");
      }
    }
    return finish(d, res);
  }

  // Email — through the existing Gmail/SMTP integration
  if (!readiness.email.ready) return finish(d, { ok: false, error: readiness.email.reason, permanent: true });
  const active = await getTransporterForShop(d.shop_id);
  if (!active) return finish(d, { ok: false, error: "Gmail/SMTP is not configured", permanent: true });
  const baseFrom = active.from || process.env.SMTP_FROM || "";
  const baseAddress = (baseFrom.match(/<([^>]+)>/)?.[1] || baseFrom).trim();
  const address = settings?.email_sender_address || baseAddress;
  const name = settings?.email_sender_name || active.shopName || "";
  const from = address ? (name ? `"${name.replace(/"/g, "")}" <${address}>` : address) : undefined;
  try {
    const pref = d.customer_id ? await getPreference(d.owner_id, d.customer_id, false) : null;
    const unsub = unsubscribeUrl(pref);
    const info = await active.transporter.sendMail({
      from,
      to: d.recipient!,
      replyTo: settings?.email_reply_to || undefined,
      subject: d.subject || "",
      text: d.body || "",
      html: d.html || undefined,
      attachments: ((d.attachments as any[]) || []).map((a) => ({ filename: a.name || "attachment", path: a.url })),
      headers: unsub ? { "List-Unsubscribe": `<${unsub}>` } : undefined,
    });
    return finish(d, { ok: true, messageId: info?.messageId });
  } catch (err: any) {
    const code = Number(err?.responseCode || 0);
    // 550/553 = mailbox does not exist / address rejected — retrying will not help
    return finish(d, { ok: false, error: err?.message || "SMTP error", permanent: code === 550 || code === 553 });
  }
}

/* ------------------------------------------------------------------ */
/* Audience                                                            */
/* ------------------------------------------------------------------ */

export interface AudienceFilters {
  search?: string;
  customerType?: "business" | "individual" | "portal" | "walk_in" | "";
  location?: string;
  dues?: "with_dues" | "no_dues" | "";
  minDue?: number | null;
  purchasedWithinDays?: number | null;
  notPurchasedWithinDays?: number | null;
  neverPurchased?: boolean;
  minTotalSpent?: number | null;
  categoryId?: number | null;
  thisShopOnly?: boolean;
}

export interface Audience {
  mode: "selected" | "filter";
  customerIds?: number[];
  filters?: AudienceFilters;
  excludeIds?: number[];
}

/** Resolves an audience to the owner's active customers (never another owner's). */
export async function resolveAudience(ownerId: number, shopId: number, audience: Audience): Promise<any[]> {
  const include = [{ model: CustomerAccount, as: "account", required: false }];
  if (audience.mode === "selected") {
    const ids = [...new Set((audience.customerIds || []).map(Number).filter(Boolean))].slice(0, 5000);
    if (!ids.length) return [];
    return Customer.findAll({ where: { owner_id: ownerId, id: { [Op.in]: ids } }, include });
  }

  const f = audience.filters || {};
  const where: any = { owner_id: ownerId, status: "active" };
  const and: any[] = [];
  if (f.search?.trim()) {
    const q = `%${f.search.trim()}%`;
    and.push({ [Op.or]: [{ name: { [Op.iLike]: q } }, { phone: { [Op.iLike]: q } }, { email: { [Op.iLike]: q } }] });
  }
  if (f.location?.trim()) and.push({ address: { [Op.iLike]: `%${f.location.trim()}%` } });
  if (f.dues === "with_dues") and.push({ current_balance: { [Op.gt]: 0 } });
  if (f.dues === "no_dues") and.push({ current_balance: { [Op.lte]: 0 } });
  if (f.minDue) and.push({ current_balance: { [Op.gte]: Number(f.minDue) } });
  if (and.length) where[Op.and] = and;

  let customers: any[] = await Customer.findAll({ where, include, order: [["name", "ASC"]] });

  if (f.customerType === "business") customers = customers.filter((c) => (c.gstin || "").trim() || (c.shop_name || "").trim());
  if (f.customerType === "individual") customers = customers.filter((c) => !(c.gstin || "").trim() && !(c.shop_name || "").trim());
  if (f.customerType === "portal") customers = customers.filter((c) => !!c.account);
  if (f.customerType === "walk_in") customers = customers.filter((c) => !c.account);

  const needStats =
    f.purchasedWithinDays || f.notPurchasedWithinDays || f.neverPurchased || f.minTotalSpent || f.thisShopOnly;
  if (needStats) {
    const rows: any[] = await sequelize.query(
      `SELECT customer_id, MAX(invoice_date) AS last_at, SUM(total_amount) AS spent,
              SUM(CASE WHEN shop_id = :shopId THEN 1 ELSE 0 END) AS here
         FROM sales WHERE owner_id = :ownerId AND status <> 'cancelled' GROUP BY customer_id`,
      { replacements: { ownerId, shopId }, type: QueryTypes.SELECT }
    );
    const stats = new Map(rows.map((r) => [Number(r.customer_id), r]));
    const now = Date.now();
    customers = customers.filter((c) => {
      const s = stats.get(c.id);
      const last = s?.last_at ? new Date(s.last_at).getTime() : 0;
      if (f.neverPurchased && s) return false;
      if (f.purchasedWithinDays && (!last || now - last > Number(f.purchasedWithinDays) * DAY)) return false;
      if (f.notPurchasedWithinDays && last && now - last <= Number(f.notPurchasedWithinDays) * DAY) return false;
      if (f.minTotalSpent && Number(s?.spent || 0) < Number(f.minTotalSpent)) return false;
      if (f.thisShopOnly && !(Number(s?.here || 0) > 0 || c.account?.shop_id === shopId)) return false;
      return true;
    });
  }

  if (f.categoryId) {
    const rows: any[] = await sequelize.query(
      `SELECT DISTINCT s.customer_id AS customer_id FROM sales s
         JOIN sale_items si ON si.sale_id = s.id
         JOIN products p ON p.id = si.product_id
        WHERE s.owner_id = :ownerId AND s.status <> 'cancelled' AND p.category_id = :categoryId`,
      { replacements: { ownerId, categoryId: Number(f.categoryId) }, type: QueryTypes.SELECT }
    );
    const ids = new Set(rows.map((r) => Number(r.customer_id)));
    customers = customers.filter((c) => ids.has(c.id));
  }

  const exclude = new Set((audience.excludeIds || []).map(Number));
  return customers.filter((c) => !exclude.has(c.id));
}

/** Recipient counts per channel for the composer preview (applies consent + contact rules). */
export async function audienceSummary(ownerId: number, shopId: number, customers: any[], sel: ChannelSelection, promotional: boolean) {
  const readiness = await channelReadiness(shopId);
  const prefs = customers.length
    ? await CustomerMessagePreference.findAll({ where: { owner_id: ownerId, customer_id: { [Op.in]: customers.map((c) => c.id) } } })
    : [];
  const byCustomer = new Map(prefs.map((p) => [p.customer_id, p]));
  const chans = channelsOf(sel);
  let whatsapp = 0;
  let email = 0;
  let reachable = 0;
  const list = customers.map((c) => {
    const pref = byCustomer.get(c.id) || null;
    const contact = contactOf(c, pref);
    const wa =
      chans.includes("whatsapp") && readiness.whatsapp.ready && !!contact.whatsapp && (pref?.allow_whatsapp ?? true) && (!promotional || (pref?.promo_whatsapp ?? true));
    const em =
      chans.includes("email") && readiness.email.ready && !!contact.email && (pref?.allow_email ?? true) && (!promotional || (pref?.promo_email ?? true));
    if (wa) whatsapp++;
    if (em) email++;
    if (wa || em) reachable++;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone || c.account?.phone || null,
      whatsapp: contact.whatsapp,
      email: contact.email,
      dueAmount: Number(c.current_balance || 0),
      willReceive: { whatsapp: wa, email: em },
    };
  });
  return { total: customers.length, reachable, whatsapp, email, readiness, recipients: list };
}

/* ------------------------------------------------------------------ */
/* Campaigns (single / group / scheduled / recurring)                  */
/* ------------------------------------------------------------------ */

function nextRun(from: Date, rec: NonNullable<MessageCampaign["recurrence"]>): Date {
  const d = new Date(from);
  const n = Math.max(1, Number(rec.interval || 1));
  if (rec.every === "day") d.setDate(d.getDate() + n);
  else if (rec.every === "week") d.setDate(d.getDate() + 7 * n);
  else d.setMonth(d.getMonth() + n);
  return d;
}

export async function campaignContent(c: MessageCampaign): Promise<MessageContent> {
  let content: MessageContent = {};
  if (c.template_id) {
    const t = await MessageTemplate.findOne({ where: { id: c.template_id, owner_id: c.owner_id, shop_id: c.shop_id } });
    if (t) content = contentFromTemplate(t);
  }
  // Text typed in the composer overrides the template's text for that channel
  return {
    ...content,
    whatsappBody: c.whatsapp_body ?? content.whatsappBody,
    emailSubject: c.email_subject ?? content.emailSubject,
    emailHtml: c.email_html ?? content.emailHtml,
    attachments: [...(content.attachments || []), ...((c.attachments as any[]) || [])],
  };
}

/** Expands a campaign run into per-recipient deliveries. Safe to call twice (claimed + deduped). */
export async function runCampaign(campaignId: number): Promise<{ deliveries: number }> {
  const [claimed] = await MessageCampaign.update(
    { status: "sending" },
    { where: { id: campaignId, status: { [Op.in]: ["scheduled", "queued"] } } }
  );
  if (!claimed) return { deliveries: 0 };
  const c = (await MessageCampaign.findByPk(campaignId))!;
  try {
    const content = await campaignContent(c);
    const customers = await resolveAudience(c.owner_id, c.shop_id, c.audience || { mode: "selected", customerIds: [] });
    const settings = await getSettingsRow(c.shop_id);
    const ctx = { settings, readiness: await channelReadiness(c.shop_id, settings), shop: await shopInfo(c.shop_id) };
    const run = c.run_count + 1;
    let count = 0;
    for (const cust of customers) {
      const rows = await enqueueForCustomer({
        ownerId: c.owner_id,
        shopId: c.shop_id,
        customerId: cust.id,
        channels: channelsOf(c.channels),
        messageType: c.message_type,
        content,
        vars: (c.variables || {}) as TemplateVars,
        campaignId: c.id,
        templateId: c.template_id,
        eventType: c.event_type,
        dedupeKey: `campaign:${c.id}:run:${run}:c:${cust.id}`,
        ctx,
      });
      count += rows.length;
    }
    const now = new Date();
    if (c.recurrence) {
      const next = nextRun(c.next_run_at || now, c.recurrence);
      const until = c.recurrence.until ? new Date(c.recurrence.until) : null;
      const done = until && next > until;
      await c.update({ status: done ? "completed" : "scheduled", next_run_at: done ? null : next, run_count: run, last_run_at: now });
    } else {
      await c.update({ status: "completed", next_run_at: null, run_count: run, last_run_at: now });
    }
    return { deliveries: count };
  } catch (err) {
    await c.update({ status: "failed" });
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Automations                                                         */
/* ------------------------------------------------------------------ */

export interface AutomationContext {
  ownerId: number;
  shopId: number;
  customerId: number;
  vars?: TemplateVars;
  reference?: { type: string; id: number } | null;
  /** Unique part of the dedupe key, e.g. "order:12". Defaults to the reference. */
  key?: string;
}

/** Fire-and-forget: never throws into the business flow that triggered it. */
export function triggerAutomation(event: AutomationEvent, ctx: AutomationContext) {
  setImmediate(() => {
    runAutomation(event, ctx).catch((err) => console.warn(`[MESSAGING] automation ${event} failed:`, err?.message || err));
  });
}

export async function runAutomation(event: AutomationEvent, ctx: AutomationContext) {
  if (!ctx.customerId || !ctx.shopId) return [];
  const settings = await getSettingsRow(ctx.shopId);
  const rule = resolveRules(settings)[event];
  let template: MessageTemplate | null = null;
  if (rule.templateId) {
    template = await MessageTemplate.findOne({ where: { id: rule.templateId, owner_id: ctx.ownerId, shop_id: ctx.shopId, is_active: true } });
  }
  const channels: MessageChannel[] = [];
  if (rule.whatsapp) channels.push("whatsapp");
  // The existing invoice / receipt emails keep sending themselves unless a custom template replaces them
  if (rule.email && (!LEGACY_EMAIL_EVENTS.includes(event) || template)) channels.push("email");
  if (!channels.length) return [];

  const content = template ? contentFromTemplate(template) : DEFAULT_EVENT_CONTENT[event];
  const key = ctx.key || (ctx.reference ? `${ctx.reference.type}:${ctx.reference.id}` : `c:${ctx.customerId}`);
  return enqueueForCustomer({
    ownerId: ctx.ownerId,
    shopId: ctx.shopId,
    customerId: ctx.customerId,
    channels,
    messageType: PROMOTIONAL_EVENTS.includes(event) ? "promotional" : "transactional",
    content,
    vars: ctx.vars,
    templateId: template?.id || null,
    eventType: event,
    dedupeKey: `${event}:${key}`,
    reference: ctx.reference || null,
  });
}

/** Today's date (YYYY-MM-DD) and hour in the business timezone. */
function today() {
  const tz = process.env.MESSAGING_TIMEZONE || "Asia/Kolkata";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()));
  return { date, hour };
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Daily automations: pending payments, due-date reminders, birthdays, festivals.
 * Runs hourly; dedupe keys make each message go out once per period. Nothing is sent
 * before MESSAGING_DAILY_HOUR (default 10:00) so greetings don't arrive at midnight.
 */
export async function runDailyAutomations(opts: { force?: boolean } = {}) {
  const { date, hour } = today();
  if (!opts.force && hour < Number(process.env.MESSAGING_DAILY_HOUR || 10)) return { skipped: "too early" };
  const rows = await MessagingSettings.findAll();
  const dayNo = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / DAY);
  const greetedOwners = new Set<string>();
  const stats = { pending: 0, due: 0, birthday: 0, festival: 0 };

  for (const s of rows) {
    const rules = resolveRules(s);
    const ownerId = s.owner_id;
    const shopId = s.shop_id;

    // Customers who have unpaid bills at THIS shop (avoids one customer getting it from every shop)
    if (rules.pending_payment.whatsapp || rules.pending_payment.email || rules.due_date_reminder.whatsapp || rules.due_date_reminder.email) {
      const unpaid: any[] = await sequelize.query(
        `SELECT id, customer_id, invoice_number, invoice_date, total_amount, due_amount FROM sales
          WHERE owner_id = :ownerId AND shop_id = :shopId AND due_amount > 0
            AND status NOT IN ('cancelled','returned','paid')`,
        { replacements: { ownerId, shopId }, type: QueryTypes.SELECT }
      );

      if (rules.pending_payment.whatsapp || rules.pending_payment.email) {
        const every = Math.max(1, Number(rules.pending_payment.days || 7));
        const period = Math.floor(dayNo / every);
        const customerIds = [...new Set(unpaid.map((r) => Number(r.customer_id)))];
        for (const cid of customerIds) {
          const c = await Customer.findOne({ where: { id: cid, owner_id: ownerId } });
          if (!c || Number(c.current_balance) <= 0) continue;
          await runAutomation("pending_payment", { ownerId, shopId, customerId: cid, key: `c:${cid}:p:${period}` });
          stats.pending++;
        }
      }

      if (rules.due_date_reminder.whatsapp || rules.due_date_reminder.email) {
        const before = Math.max(0, Number(rules.due_date_reminder.days ?? 3));
        const credit = Math.max(0, Number(s.credit_days ?? 15));
        for (const sale of unpaid) {
          const due = new Date(new Date(sale.invoice_date).getTime() + credit * DAY);
          const dueDay = Math.floor(new Date(due.toISOString().slice(0, 10) + "T00:00:00Z").getTime() / DAY);
          const left = dueDay - dayNo;
          if (left !== before && left !== 0) continue;
          await runAutomation("due_date_reminder", {
            ownerId,
            shopId,
            customerId: Number(sale.customer_id),
            reference: { type: "sale", id: Number(sale.id) },
            key: `sale:${sale.id}:d:${left}`,
            vars: {
              order_number: sale.invoice_number,
              order_amount: inr(sale.total_amount),
              due_amount: inr(sale.due_amount),
              due_date: fmtDate(due),
              invoice_link: `${WEB_URL()}/#/portal/bills/${sale.id}`,
            },
          });
          stats.due++;
        }
      }
    }

    // Birthdays: once per owner (first shop with the rule on), not once per shop
    if ((rules.birthday_greeting.whatsapp || rules.birthday_greeting.email) && !greetedOwners.has(`b:${ownerId}`)) {
      greetedOwners.add(`b:${ownerId}`);
      const mmdd = date.slice(5);
      const prefs = await CustomerMessagePreference.findAll({ where: { owner_id: ownerId, date_of_birth: { [Op.ne]: null } } });
      for (const p of prefs) {
        if (String(p.date_of_birth).slice(5, 10) !== mmdd) continue;
        await runAutomation("birthday_greeting", { ownerId, shopId, customerId: p.customer_id, key: `c:${p.customer_id}:y:${date.slice(0, 4)}` });
        stats.birthday++;
      }
    }

    // Festivals configured by the shop (date = YYYY-MM-DD)
    if (rules.festival_greeting.whatsapp || rules.festival_greeting.email) {
      const fest = ((s.festivals || []) as any[]).filter((f) => f?.date === date && f?.name);
      for (const f of fest) {
        const customers = await resolveAudience(ownerId, shopId, { mode: "filter", filters: { thisShopOnly: true } });
        for (const c of customers) {
          await runAutomation("festival_greeting", {
            ownerId,
            shopId,
            customerId: c.id,
            key: `${String(f.name).toLowerCase().replace(/\W+/g, "-")}:${date}:c:${c.id}`,
            vars: { festival_name: f.name },
          });
          stats.festival++;
        }
      }
    }
  }
  return stats;
}

/* ------------------------------------------------------------------ */
/* Worker                                                              */
/* ------------------------------------------------------------------ */

let running = false;
let kickTimer: NodeJS.Timeout | null = null;

export function kickQueue() {
  if (kickTimer) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    processQueue().catch((err) => console.warn("[MESSAGING] queue error:", err?.message || err));
  }, 250);
}

/** Sends due messages and starts due scheduled/recurring campaigns. */
export async function processQueue(): Promise<{ sent: number; campaigns: number }> {
  if (running) return { sent: 0, campaigns: 0 };
  running = true;
  let sent = 0;
  let campaigns = 0;
  try {
    const now = new Date();
    // Recover messages stuck in "sending" after a crash/restart
    await MessageDelivery.update(
      { status: "queued" },
      { where: { status: "sending", updated_at: { [Op.lt]: new Date(now.getTime() - 10 * 60000) } } }
    );
    const due = await MessageCampaign.findAll({
      where: { status: "scheduled", next_run_at: { [Op.lte]: now } },
      limit: 10,
      order: [["next_run_at", "ASC"]],
    });
    for (const c of due) {
      await runCampaign(c.id).catch((err) => console.warn(`[MESSAGING] campaign ${c.id} failed:`, err?.message || err));
      campaigns++;
    }
    for (let batch = 0; batch < 10; batch++) {
      const items = await MessageDelivery.findAll({
        where: { status: "queued", next_attempt_at: { [Op.lte]: new Date() } },
        order: [["id", "ASC"]],
        limit: 50,
      });
      if (!items.length) break;
      for (const d of items) {
        await sendDelivery(d).catch((err) => console.warn(`[MESSAGING] delivery ${d.id} failed:`, err?.message || err));
        sent++;
      }
    }
  } finally {
    running = false;
  }
  return { sent, campaigns };
}

let started = false;
export function startMessagingWorker() {
  if (started || process.env.MESSAGING_WORKER === "off") return;
  started = true;
  setInterval(() => kickQueue(), 30000).unref();
  const daily = () => runDailyAutomations().catch((err) => console.warn("[MESSAGING] daily automations failed:", err?.message || err));
  setInterval(daily, 3600000).unref();
  setTimeout(daily, 60000).unref();
  kickQueue();
  console.log("✅ Messaging worker started");
}

/* ------------------------------------------------------------------ */
/* WhatsApp webhook                                                    */
/* ------------------------------------------------------------------ */

const STATUS_RANK: Record<string, number> = { queued: 0, sending: 1, sent: 2, delivered: 3, read: 4 };

export function verifyWebhookSignature(rawBody: Buffer | undefined, header: string | undefined, secrets: string[]) {
  if (!rawBody || !header?.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7), "hex");
  return secrets.some((secret) => {
    const want = crypto.createHmac("sha256", secret).update(rawBody).digest();
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  });
}

/** Applies delivery/read statuses and inbound messages (24h window, STOP/START opt-out). */
export async function handleWhatsAppWebhook(body: any) {
  const result = { statuses: 0, inbound: 0 };
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const shops = await MessagingSettings.findAll({ where: { wa_phone_number_id: String(phoneNumberId) } });
      if (!shops.length) continue;
      const shopIds = shops.map((s) => s.shop_id);

      for (const st of value.statuses || []) {
        const d = await MessageDelivery.findOne({ where: { provider_message_id: st.id, shop_id: { [Op.in]: shopIds }, channel: "whatsapp" } });
        if (!d) continue;
        const at = st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date();
        const log = [...((d.log as any[]) || []), logEntry(`webhook_${st.status}`)];
        if (st.status === "failed") {
          const e = st.errors?.[0];
          await d.update({ status: "failed", failure_reason: [e?.title, e?.error_data?.details].filter(Boolean).join(" — ") || "Failed on WhatsApp", log });
        } else if (STATUS_RANK[st.status] !== undefined && STATUS_RANK[st.status] > (STATUS_RANK[d.status] ?? -1)) {
          const patch: any = { status: st.status, log };
          if (st.status === "delivered") patch.delivered_at = at;
          if (st.status === "read") {
            patch.read_at = at;
            if (!d.delivered_at) patch.delivered_at = at;
          }
          await d.update(patch);
        }
        result.statuses++;
      }

      for (const m of value.messages || []) {
        const from = normalizeWhatsAppNumber(m.from);
        if (!from) continue;
        const ownerIds = [...new Set(shops.map((s) => s.owner_id))];
        for (const ownerId of ownerIds) {
          const candidates: any[] = await Customer.findAll({
            where: { owner_id: ownerId, phone: { [Op.like]: `%${from.slice(-10)}` } },
            include: [{ model: CustomerAccount, as: "account", required: false }],
          });
          const prefsWithNumber = await CustomerMessagePreference.findAll({ where: { owner_id: ownerId, whatsapp_number: { [Op.like]: `%${from.slice(-10)}` } } });
          const ids = new Set<number>([...candidates.map((c) => c.id), ...prefsWithNumber.map((p) => p.customer_id)]);
          for (const cid of ids) {
            const pref = await getPreference(ownerId, cid);
            if (!pref) continue;
            const text = String(m.text?.body || m.button?.text || "").trim().toUpperCase();
            const patch: any = { last_inbound_at: new Date(Number(m.timestamp || Date.now() / 1000) * 1000) };
            if (["STOP", "UNSUBSCRIBE", "STOP PROMOTIONS"].includes(text)) {
              patch.promo_whatsapp = false;
              patch.opted_out_at = new Date();
            }
            if (text === "START") patch.promo_whatsapp = true;
            await pref.update(patch);
            result.inbound++;
          }
        }
      }
    }
  }
  return result;
}
