import { Request, Response } from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { Customer, CustomerAccount, EmailNotification, Shop } from "../models";
import {
  MessagingSettings,
  MessageTemplate,
  MessageCampaign,
  MessageDelivery,
  CustomerMessagePreference,
  AUTOMATION_EVENTS,
  type AutomationRule,
  type ChannelSelection,
} from "../models/Messaging";
import { encryptSecret, secretHint } from "../utils/messaging/secrets";
import { TEMPLATE_VARIABLES, renderHtml, renderText, wrapEmail } from "../utils/messaging/render";
import { getSettingsRow, resolveRules, LEGACY_EMAIL_EVENTS } from "../utils/messaging/settings";
import { listApprovedTemplates, verifyWhatsAppCredentials, normalizeWhatsAppNumber, sendWhatsAppTemplate, createWhatsAppTemplate } from "../utils/messaging/whatsapp";
import { STARTER_TEMPLATES, toWhatsAppTemplateBody, whatsAppTemplateName } from "../utils/messaging/starterTemplates";
import {
  audienceSummary,
  baseVars,
  channelReadiness,
  contactOf,
  getPreference,
  handleWhatsAppWebhook,
  kickQueue,
  resolveAudience,
  runCampaign,
  unsubscribeUrl,
  verifyWebhookSignature,
  whatsappCredentials,
  campaignContent,
  type Audience,
} from "../utils/messaging/engine";
import { getTransporterForShop, relayEnabled } from "../utils/mailer";
import { decryptSecret } from "../utils/messaging/secrets";

const ctx = (req: Request) => ({ ownerId: req.auth!.ownerId, shopId: Number(req.auth!.shopId) });
const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });
const CHANNELS: ChannelSelection[] = ["whatsapp", "email", "both"];
const str = (v: any, max = 5000) => (v === undefined || v === null ? null : String(v).slice(0, max));

async function settingsFor(ownerId: number, shopId: number) {
  let row = await MessagingSettings.findOne({ where: { shop_id: shopId, owner_id: ownerId } });
  if (!row) row = await MessagingSettings.create({ owner_id: ownerId, shop_id: shopId });
  return row;
}

function apiBase(req: Request) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  return `${proto}://${req.get("host")}`;
}

function publicSettings(row: MessagingSettings | null, req: Request) {
  return {
    whatsapp: {
      enabled: !!row?.whatsapp_enabled,
      phoneNumberId: row?.wa_phone_number_id || "",
      businessAccountId: row?.wa_business_account_id || "",
      displayNumber: row?.wa_display_number || "",
      apiVersion: row?.wa_api_version || "v21.0",
      accessTokenSet: !!row?.wa_access_token_enc,
      accessTokenHint: secretHint(row?.wa_access_token_enc),
      appSecretSet: !!row?.wa_app_secret_enc,
      verifyToken: row?.wa_webhook_verify_token || "",
      webhookUrl: `${apiBase(req)}/api/messaging/webhooks/whatsapp`,
    },
    email: {
      enabled: row ? row.email_enabled !== false : true,
      senderName: row?.email_sender_name || "",
      senderAddress: row?.email_sender_address || "",
      replyTo: row?.email_reply_to || "",
      // The shop's own mailbox. Password is write-only: only "is set" + hint go back.
      account: {
        host: row?.email_smtp_host || "",
        port: row?.email_smtp_port || null,
        secure: row?.email_smtp_secure ?? null,
        user: row?.email_smtp_user || "",
        passwordSet: !!row?.email_smtp_pass_enc,
        connected: !!(row?.email_smtp_host && row?.email_smtp_user && row?.email_smtp_pass_enc),
      },
    },
    automations: resolveRules(row),
    legacyEmailEvents: LEGACY_EMAIL_EVENTS,
    festivals: row?.festivals || [],
    creditDays: row?.credit_days ?? 15,
  };
}

/* ---------------- Overview & settings ---------------- */

export async function getOverview(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const row = await getSettingsRow(shopId);
  const readiness = await channelReadiness(shopId, row);
  const since = new Date(Date.now() - 30 * 86400000);
  const recent = await MessageDelivery.findAll({
    where: { owner_id: ownerId, shop_id: shopId, created_at: { [Op.gte]: since } },
    attributes: ["channel", "status"],
  });
  const counts: Record<string, Record<string, number>> = { whatsapp: {}, email: {} };
  for (const d of recent) counts[d.channel][d.status] = (counts[d.channel][d.status] || 0) + 1;
  const scheduled = await MessageCampaign.count({ where: { owner_id: ownerId, shop_id: shopId, status: "scheduled" } });
  return res.json({ success: true, data: { readiness, counts, scheduled, settings: publicSettings(row, req), variables: TEMPLATE_VARIABLES } });
}

export async function getSettings(req: Request, res: Response) {
  const { shopId } = ctx(req);
  const row = await getSettingsRow(shopId);
  return res.json({ success: true, data: { ...publicSettings(row, req), readiness: await channelReadiness(shopId, row) } });
}

export async function updateWhatsAppSettings(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const b = req.body || {};
  const row = await settingsFor(ownerId, shopId);
  const patch: any = {};
  if (b.enabled !== undefined) patch.whatsapp_enabled = !!b.enabled;
  if (b.phoneNumberId !== undefined) patch.wa_phone_number_id = str(b.phoneNumberId, 64)?.trim() || null;
  if (b.businessAccountId !== undefined) patch.wa_business_account_id = str(b.businessAccountId, 64)?.trim() || null;
  if (b.displayNumber !== undefined) patch.wa_display_number = str(b.displayNumber, 32)?.trim() || null;
  if (b.apiVersion !== undefined) {
    const v = String(b.apiVersion || "").trim();
    if (v && !/^v\d+\.\d+$/.test(v)) return fail(res, 400, "API version must look like v21.0");
    patch.wa_api_version = v || null;
  }
  if (typeof b.accessToken === "string" && b.accessToken.trim()) patch.wa_access_token_enc = encryptSecret(b.accessToken.trim());
  if (b.clearAccessToken) patch.wa_access_token_enc = null;
  if (typeof b.appSecret === "string" && b.appSecret.trim()) patch.wa_app_secret_enc = encryptSecret(b.appSecret.trim());
  if (b.verifyToken !== undefined) patch.wa_webhook_verify_token = str(b.verifyToken, 128)?.trim() || null;
  if (!row.wa_webhook_verify_token && !patch.wa_webhook_verify_token) patch.wa_webhook_verify_token = crypto.randomBytes(16).toString("hex");
  await row.update(patch);
  if (row.whatsapp_enabled && !whatsappCredentials(row)) {
    return res.json({
      success: true,
      message: "Saved. WhatsApp stays unavailable until the Phone number ID and access token are set.",
      data: publicSettings(row, req),
    });
  }
  return res.json({ success: true, message: "WhatsApp settings saved", data: publicSettings(row, req) });
}

export async function verifyWhatsApp(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const row = await settingsFor(ownerId, shopId);
  const creds = whatsappCredentials(row);
  if (!creds) return fail(res, 400, "Enter the Phone number ID and access token first");
  const r = await verifyWhatsAppCredentials(creds);
  if (!r.ok) return fail(res, 400, `WhatsApp rejected the credentials: ${r.error}`);
  if (r.displayNumber && !row.wa_display_number) await row.update({ wa_display_number: r.displayNumber });
  return res.json({ success: true, message: `Connected: ${r.verifiedName || ""} ${r.displayNumber || ""}`.trim(), data: r });
}

/**
 * Sends Meta's built-in "hello_world" template (present on every new WhatsApp Business
 * Account) to the owner's own phone, so setup can be checked end to end.
 */
export async function sendTestWhatsApp(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const row = await settingsFor(ownerId, shopId);
  const creds = whatsappCredentials(row);
  if (!creds) return fail(res, 400, "Save the Phone number ID and access token first");
  const to = normalizeWhatsAppNumber(String(req.body?.to || ""));
  if (!to) return fail(res, 400, "Enter a valid mobile number, e.g. 98765 43210");
  const r = await sendWhatsAppTemplate(creds, to, { name: "hello_world", language: "en_US", params: [] });
  if (!r.ok) return fail(res, 400, `WhatsApp did not send the test: ${r.error}`);
  return res.json({ success: true, message: `Test WhatsApp sent to +${to}. It should arrive in a few seconds.` });
}

export async function listWhatsAppTemplates(req: Request, res: Response) {
  const { shopId } = ctx(req);
  const creds = whatsappCredentials(await getSettingsRow(shopId));
  if (!creds) return fail(res, 400, "WhatsApp is not connected");
  const r = await listApprovedTemplates(creds);
  if (!r.ok) return fail(res, 400, r.error || "Could not load WhatsApp templates");
  return res.json({ success: true, data: r.templates });
}

export async function updateEmailSettings(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const b = req.body || {};
  const row = await settingsFor(ownerId, shopId);
  const patch: any = {};
  if (b.enabled !== undefined) patch.email_enabled = !!b.enabled;
  if (b.senderName !== undefined) patch.email_sender_name = str(b.senderName, 120)?.trim() || null;
  for (const [k, col] of [["senderAddress", "email_sender_address"], ["replyTo", "email_reply_to"]] as const) {
    if (b[k] !== undefined) {
      const v = String(b[k] || "").trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return fail(res, 400, `${k === "replyTo" ? "Reply-to" : "Sender"} email is not valid`);
      patch[col] = v || null;
    }
  }
  // The shop's own mailbox (send from the shop's Gmail/SMTP instead of the platform one)
  if (b.clearAccount) {
    Object.assign(patch, { email_smtp_host: null, email_smtp_port: null, email_smtp_secure: null, email_smtp_user: null, email_smtp_pass_enc: null });
  } else if (b.account && typeof b.account === "object") {
    const a = b.account;
    const host = String(a.host ?? row.email_smtp_host ?? "").trim().toLowerCase();
    const user = String(a.user ?? row.email_smtp_user ?? "").trim();
    const port = a.port === undefined || a.port === null || a.port === "" ? row.email_smtp_port || 587 : Number(a.port);
    // Gmail shows App Passwords as "abcd efgh ijkl mnop": the spaces are not part of it
    const newPass = typeof a.password === "string" ? (host === "smtp.gmail.com" ? a.password.replace(/\s+/g, "") : a.password) : "";
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$|^\d{1,3}(\.\d{1,3}){3}$|^localhost$/.test(host)) return fail(res, 400, "Enter a valid SMTP server, e.g. smtp.gmail.com");
    if (!Number.isInteger(port) || port < 1 || port > 65535) return fail(res, 400, "SMTP port must be a number like 465 or 587");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return fail(res, 400, "Email login must be a full email address");
    // A saved password only belongs to the mailbox it was saved for
    const sameMailbox = row.email_smtp_host === host && row.email_smtp_user === user;
    if (!newPass && !(row.email_smtp_pass_enc && sameMailbox)) return fail(res, 400, "Enter the email password (for Gmail, an App Password)");
    patch.email_smtp_host = host;
    patch.email_smtp_port = port;
    patch.email_smtp_secure = a.secure === undefined ? port === 465 : !!a.secure;
    patch.email_smtp_user = user;
    if (newPass) patch.email_smtp_pass_enc = encryptSecret(newPass.slice(0, 256));
  }
  await row.update(patch);
  return res.json({ success: true, message: "Email settings saved", data: publicSettings(row, req) });
}

export async function sendTestEmail(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const to = String(req.body?.to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail(res, 400, "Enter a valid email address");
  const active = await getTransporterForShop(shopId);
  if (!active) return fail(res, 400, "Gmail/SMTP is not configured on the server or for this shop");
  const row = await settingsFor(ownerId, shopId);
  const baseFrom = active.from || process.env.SMTP_FROM || "";
  const address = active.own ? active.ownAddress : row.email_sender_address || (baseFrom.match(/<([^>]+)>/)?.[1] || baseFrom).trim();
  const name = row.email_sender_name || active.shopName || "";
  try {
    await active.transporter.sendMail({
      from: address ? (name ? `"${name.replace(/"/g, "")}" <${address}>` : address) : undefined,
      to,
      replyTo: row.email_reply_to || undefined,
      subject: `Test email from ${active.shopName || "your shop"}`,
      text: "Your email channel is working.",
      html: wrapEmail({ shopName: active.shopName || "Your shop", bodyHtml: "<p>Your email channel is working.</p>" }),
    });
    return res.json({ success: true, message: `Test email sent to ${to}${address ? ` from ${address}` : ""}` });
  } catch (err: any) {
    const code = Number(err?.responseCode || 0);
    if (active.own && (code === 535 || code === 534 || err?.code === "EAUTH")) {
      return fail(res, 400, "Your email provider rejected the login. For Gmail, turn on 2-Step Verification and use an App Password, not your normal password.");
    }
    if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNREFUSED"].includes(err?.code)) {
      if (!relayEnabled()) {
        return fail(res, 400, `Could not reach the mail server (${err.code}). The server's hosting blocks direct mail connections, so the email relay must be set up (EMAIL_RELAY_URL).`);
      }
      return fail(res, 400, `Could not reach the mail server (${err.code}). Check the SMTP server and port.`);
    }
    return fail(res, 400, `Sending failed: ${err?.message || "SMTP error"}`);
  }
}

export async function updateAutomations(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const b = req.body || {};
  const row = await settingsFor(ownerId, shopId);
  const patch: any = {};
  if (b.automations && typeof b.automations === "object") {
    const next: Record<string, AutomationRule> = { ...(row.automations || {}) };
    for (const ev of AUTOMATION_EVENTS) {
      const r = b.automations[ev];
      if (!r) continue;
      let templateId: number | null = r.templateId ? Number(r.templateId) : null;
      if (templateId) {
        const t = await MessageTemplate.findOne({ where: { id: templateId, owner_id: ownerId, shop_id: shopId } });
        if (!t) templateId = null;
      }
      next[ev] = {
        whatsapp: !!r.whatsapp,
        email: !!r.email,
        templateId,
        ...(r.days !== undefined ? { days: Math.max(0, Math.min(90, Number(r.days) || 0)) } : {}),
      };
    }
    patch.automations = next;
  }
  if (Array.isArray(b.festivals)) {
    patch.festivals = b.festivals
      .filter((f: any) => f && f.name && /^\d{4}-\d{2}-\d{2}$/.test(String(f.date)))
      .slice(0, 50)
      .map((f: any) => ({ name: String(f.name).slice(0, 60), date: String(f.date) }));
  }
  if (b.creditDays !== undefined) patch.credit_days = Math.max(0, Math.min(365, Number(b.creditDays) || 0));
  await row.update(patch);
  return res.json({ success: true, message: "Automations saved", data: publicSettings(row, req) });
}

/* ---------------- Templates ---------------- */

function templateFields(b: any) {
  const attachments = Array.isArray(b.attachments)
    ? b.attachments
        .filter((a: any) => a && /^https?:\/\//i.test(String(a.url || "")))
        .slice(0, 5)
        .map((a: any) => ({ name: String(a.name || "attachment").slice(0, 120), url: String(a.url).slice(0, 1000) }))
    : undefined;
  return {
    ...(b.name !== undefined ? { name: String(b.name).trim().slice(0, 120) } : {}),
    ...(b.category !== undefined ? { category: String(b.category || "general").slice(0, 40) } : {}),
    ...(b.messageType !== undefined ? { message_type: b.messageType === "promotional" ? "promotional" : "transactional" } : {}),
    ...(b.whatsappBody !== undefined ? { whatsapp_body: str(b.whatsappBody, 4096) } : {}),
    ...(b.waTemplateName !== undefined ? { wa_template_name: str(b.waTemplateName, 120)?.trim() || null } : {}),
    ...(b.waTemplateLanguage !== undefined ? { wa_template_language: str(b.waTemplateLanguage, 12)?.trim() || null } : {}),
    ...(b.waTemplateParams !== undefined
      ? { wa_template_params: Array.isArray(b.waTemplateParams) ? b.waTemplateParams.slice(0, 20).map((x: any) => String(x).slice(0, 500)) : [] }
      : {}),
    ...(b.emailSubject !== undefined ? { email_subject: str(b.emailSubject, 255) } : {}),
    ...(b.emailHtml !== undefined ? { email_html: str(b.emailHtml, 100000) } : {}),
    ...(attachments !== undefined ? { attachments } : {}),
    ...(b.isActive !== undefined ? { is_active: !!b.isActive } : {}),
  };
}

export async function listTemplates(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const rows = await MessageTemplate.findAll({ where: { owner_id: ownerId, shop_id: shopId }, order: [["updated_at", "DESC"]] });
  return res.json({ success: true, data: rows });
}

export async function createTemplate(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const f: any = templateFields(req.body || {});
  if (!f.name) return fail(res, 400, "Template name is required");
  if (!f.whatsapp_body && !f.wa_template_name && !f.email_html) return fail(res, 400, "Add WhatsApp content, an approved WhatsApp template, or an email body");
  const row = await MessageTemplate.create({ ...f, owner_id: ownerId, shop_id: shopId });
  return res.status(201).json({ success: true, message: "Template created", data: row });
}

export async function updateTemplate(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const row = await MessageTemplate.findOne({ where: { id: Number(req.params.id), owner_id: ownerId, shop_id: shopId } });
  if (!row) return fail(res, 404, "Template not found");
  const f: any = templateFields(req.body || {});
  if (f.name === "") return fail(res, 400, "Template name is required");
  await row.update(f);
  return res.json({ success: true, message: "Template saved", data: row });
}

export async function deleteTemplate(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const row = await MessageTemplate.findOne({ where: { id: Number(req.params.id), owner_id: ownerId, shop_id: shopId } });
  if (!row) return fail(res, 404, "Template not found");
  // Automations using it fall back to the built-in wording
  const settings = await MessagingSettings.findOne({ where: { shop_id: shopId, owner_id: ownerId } });
  if (settings?.automations) {
    const next: any = { ...settings.automations };
    for (const k of Object.keys(next)) if (next[k]?.templateId === row.id) next[k] = { ...next[k], templateId: null };
    await settings.update({ automations: next });
  }
  await row.destroy();
  return res.json({ success: true, message: "Template deleted" });
}

/* ---------------- Ready-made template library ---------------- */

export async function listTemplateLibrary(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const have = new Set(
    (await MessageTemplate.findAll({ where: { owner_id: ownerId, shop_id: shopId }, attributes: ["name"] })).map((t) => t.name.trim().toLowerCase())
  );
  return res.json({ success: true, data: STARTER_TEMPLATES.map((t) => ({ ...t, added: have.has(t.name.toLowerCase()) })) });
}

/**
 * Adds ready-made templates (all, or the given keys) that this shop doesn't have yet.
 * Automations still on the built-in wording are pointed at the new template, so
 * later edits to it change the automatic message too.
 */
export async function addTemplateLibrary(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const keys: string[] | null = Array.isArray(req.body?.keys) ? req.body.keys.map(String) : null;
  const wanted = STARTER_TEMPLATES.filter((t) => !keys || keys.includes(t.key));
  if (!wanted.length) return fail(res, 400, "Pick at least one template");
  const existing = await MessageTemplate.findAll({ where: { owner_id: ownerId, shop_id: shopId } });
  const byName = new Map(existing.map((t) => [t.name.trim().toLowerCase(), t]));

  const settings = await settingsFor(ownerId, shopId);
  const automations: any = { ...(settings.automations || {}) };
  let created = 0;
  let linked = 0;
  for (const t of wanted) {
    let row = byName.get(t.name.toLowerCase());
    if (!row) {
      row = await MessageTemplate.create({
        owner_id: ownerId,
        shop_id: shopId,
        name: t.name,
        category: t.category,
        message_type: t.messageType,
        whatsapp_body: t.whatsappBody,
        email_subject: t.emailSubject,
        email_html: t.emailHtml,
        is_active: true,
      });
      created++;
    }
    if (t.event && !automations[t.event]?.templateId) {
      automations[t.event] = { ...resolveRules(settings)[t.event], ...(automations[t.event] || {}), templateId: row.id };
      linked++;
    }
  }
  if (linked) await settings.update({ automations });
  const skipped = wanted.length - created;
  return res.status(created ? 201 : 200).json({
    success: true,
    message: created
      ? `${created} template${created === 1 ? "" : "s"} added${skipped ? `, ${skipped} already there` : ""}`
      : "All of these templates are already added",
    data: { created, skipped, linked },
  });
}

/**
 * Sends this shop's templates to Meta for approval as WhatsApp message templates, so
 * WhatsApp messages can also reach customers outside the 24-hour reply window.
 */
export async function submitWhatsAppTemplates(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const creds = whatsappCredentials(await settingsFor(ownerId, shopId));
  if (!creds) return fail(res, 400, "Connect WhatsApp first (Settings › Communication)");
  if (!creds.businessAccountId) return fail(res, 400, "Add the WhatsApp Business Account ID first (Settings › Communication)");
  const ids: number[] | null = Array.isArray(req.body?.templateIds) ? req.body.templateIds.map(Number) : null;
  const rows = (await MessageTemplate.findAll({ where: { owner_id: ownerId, shop_id: shopId } })).filter(
    (t) => t.whatsapp_body && !t.wa_template_name && (!ids || ids.includes(t.id))
  );
  if (!rows.length) return fail(res, 400, "No templates waiting to be sent to WhatsApp");

  const results: Array<{ id: number; name: string; ok: boolean; metaName?: string; status?: string; error?: string }> = [];
  for (const t of rows.slice(0, 30)) {
    const conv = toWhatsAppTemplateBody(t.whatsapp_body || "");
    const metaName = whatsAppTemplateName(t.name, t.id);
    const r = await createWhatsAppTemplate(creds, {
      name: metaName,
      language: "en",
      category: t.message_type === "promotional" ? "MARKETING" : "UTILITY",
      text: conv.text,
      examples: conv.examples,
    });
    if (r.ok) await t.update({ wa_template_name: metaName, wa_template_language: "en", wa_template_params: conv.params });
    results.push({ id: t.id, name: t.name, ok: r.ok, metaName: r.ok ? metaName : undefined, status: r.status, error: r.error });
  }
  const sent = results.filter((r) => r.ok).length;
  return res.json({
    success: true,
    message: sent
      ? `${sent} template${sent === 1 ? "" : "s"} sent to WhatsApp for approval. Meta usually approves within a few minutes to a day.`
      : "WhatsApp did not accept the templates. See the reasons below.",
    data: { sent, failed: results.length - sent, results },
  });
}

export async function uploadAttachment(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return fail(res, 400, "No file uploaded");
  return res.status(201).json({
    success: true,
    data: { name: file.originalname.slice(0, 120), url: `${apiBase(req)}/uploads/messaging/${file.filename}` },
  });
}

/* ---------------- Customers & audience ---------------- */

export async function searchCustomers(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const q = String(req.query.search || "").trim();
  const where: any = { owner_id: ownerId, status: "active" };
  if (q) where[Op.or] = [{ name: { [Op.iLike]: `%${q}%` } }, { phone: { [Op.iLike]: `%${q}%` } }, { email: { [Op.iLike]: `%${q}%` } }];
  const ids = String(req.query.ids || "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  if (ids.length) where.id = { [Op.in]: ids };
  const customers: any[] = await Customer.findAll({
    where,
    include: [{ model: CustomerAccount, as: "account", required: false }],
    order: [["name", "ASC"]],
    limit: Math.min(100, Number(req.query.limit) || 30),
  });
  const summary = await audienceSummary(ownerId, shopId, customers, "both", false);
  const prefs = await CustomerMessagePreference.findAll({ where: { owner_id: ownerId, customer_id: { [Op.in]: customers.map((c) => c.id) } } });
  const byId = new Map(prefs.map((p) => [p.customer_id, p]));
  return res.json({
    success: true,
    data: summary.recipients.map((r: any) => {
      const p = byId.get(r.id);
      return {
        ...r,
        preferences: {
          allowWhatsapp: p?.allow_whatsapp ?? true,
          allowEmail: p?.allow_email ?? true,
          promoWhatsapp: p?.promo_whatsapp ?? true,
          promoEmail: p?.promo_email ?? true,
        },
      };
    }),
  });
}

function parseAudience(b: any): Audience | null {
  const a = b?.audience;
  if (!a) return null;
  if (a.mode === "selected") return { mode: "selected", customerIds: (a.customerIds || []).map(Number).filter(Boolean) };
  if (a.mode === "filter") return { mode: "filter", filters: a.filters || {}, excludeIds: (a.excludeIds || []).map(Number).filter(Boolean) };
  return null;
}

export async function previewAudience(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const audience = parseAudience(req.body);
  if (!audience) return fail(res, 400, "Choose customers or filters");
  const channels: ChannelSelection = CHANNELS.includes(req.body.channels) ? req.body.channels : "both";
  const customers = await resolveAudience(ownerId, shopId, audience);
  const s = await audienceSummary(ownerId, shopId, customers, channels, req.body.messageType === "promotional");
  return res.json({ success: true, data: { ...s, recipients: s.recipients.slice(0, 500), truncated: s.recipients.length > 500 } });
}

/** Renders the message exactly as one real customer would receive it. */
export async function previewMessage(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const b = req.body || {};
  let template: MessageTemplate | null = null;
  if (b.templateId) template = await MessageTemplate.findOne({ where: { id: Number(b.templateId), owner_id: ownerId, shop_id: shopId } });
  const customer: any = b.customerId
    ? await Customer.findOne({ where: { id: Number(b.customerId), owner_id: ownerId }, include: [{ model: CustomerAccount, as: "account", required: false }] })
    : null;
  const shop = await Shop.findByPk(shopId);
  const shopInfo = { name: shop?.name || "Our shop", settings: (shop?.settings || {}) as any };
  const pref = customer ? await getPreference(ownerId, customer.id) : null;
  const vars = { ...baseVars(customer || { name: "Customer" }, shopInfo, pref), ...(b.variables || {}) };
  const waBody = b.whatsappBody ?? template?.whatsapp_body ?? "";
  const waTemplateName = template?.wa_template_name || null;
  const subject = b.emailSubject ?? template?.email_subject ?? "";
  const html = b.emailHtml ?? template?.email_html ?? "";
  const promotional = (b.messageType || template?.message_type) === "promotional";
  return res.json({
    success: true,
    data: {
      customer: customer ? { id: customer.id, name: customer.name, ...contactOf(customer, pref) } : null,
      whatsapp: {
        text: renderText(waBody, vars),
        approvedTemplate: waTemplateName
          ? { name: waTemplateName, language: template?.wa_template_language || "en", params: ((template?.wa_template_params || []) as string[]).map((p) => renderText(p, vars)) }
          : null,
      },
      email: {
        subject: renderText(subject || `Message from ${shopInfo.name}`, vars),
        html: wrapEmail({ shopName: shopInfo.name, bodyHtml: renderHtml(html, vars), unsubscribeUrl: unsubscribeUrl(pref), promotional }),
      },
      attachments: [...((template?.attachments || []) as any[]), ...(Array.isArray(b.attachments) ? b.attachments : [])],
    },
  });
}

/* ---------------- Sending & campaigns ---------------- */

export async function sendMessage(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const b = req.body || {};
  const channels: ChannelSelection = b.channels;
  if (!CHANNELS.includes(channels)) return fail(res, 400, "Choose WhatsApp, Email or both");
  const audience = parseAudience(b);
  if (!audience) return fail(res, 400, "Choose at least one customer");
  if (audience.mode === "selected" && !audience.customerIds?.length) return fail(res, 400, "Choose at least one customer");

  let template: MessageTemplate | null = null;
  if (b.templateId) {
    template = await MessageTemplate.findOne({ where: { id: Number(b.templateId), owner_id: ownerId, shop_id: shopId } });
    if (!template) return fail(res, 404, "Template not found");
  }
  const hasWa = !!(b.whatsappBody || template?.whatsapp_body || template?.wa_template_name);
  const hasEmail = !!(b.emailHtml || template?.email_html);
  if ((channels === "whatsapp" || channels === "both") && !hasWa) return fail(res, 400, "Write the WhatsApp message or pick a template that has one");
  if ((channels === "email" || channels === "both") && !hasEmail) return fail(res, 400, "Write the email or pick a template that has one");

  const readiness = await channelReadiness(shopId);
  const wanted = channels === "both" ? ["whatsapp", "email"] : [channels];
  const usable = wanted.filter((c) => (readiness as any)[c].ready);
  if (!usable.length) {
    return fail(res, 400, wanted.map((c) => (readiness as any)[c].reason).join(". "));
  }

  const scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
  if (scheduledAt && isNaN(scheduledAt.getTime())) return fail(res, 400, "Schedule date is not valid");
  let recurrence: any = null;
  if (b.recurrence?.every) {
    if (!["day", "week", "month"].includes(b.recurrence.every)) return fail(res, 400, "Repeat must be daily, weekly or monthly");
    recurrence = {
      every: b.recurrence.every,
      interval: Math.max(1, Math.min(12, Number(b.recurrence.interval) || 1)),
      until: b.recurrence.until || null,
    };
  }
  const later = !!recurrence || (scheduledAt && scheduledAt.getTime() > Date.now() + 30000);

  const attachments = Array.isArray(b.attachments)
    ? b.attachments.filter((a: any) => a && /^https?:\/\//i.test(String(a.url || ""))).slice(0, 5).map((a: any) => ({ name: String(a.name || "attachment").slice(0, 120), url: String(a.url) }))
    : [];
  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(b.variables || {})) if (/^[a-z0-9_]+$/i.test(k)) variables[k] = String(v ?? "").slice(0, 500);

  const campaign = await MessageCampaign.create({
    owner_id: ownerId,
    shop_id: shopId,
    created_by_type: req.auth!.isOwner ? "owner" : "employee",
    created_by_id: req.auth!.isOwner ? ownerId : req.auth!.employeeId || null,
    kind: audience.mode === "selected" && audience.customerIds!.length === 1 ? "single" : "group",
    title: str(b.title, 160) || (template ? template.name : null),
    message_type: b.messageType === "promotional" || template?.message_type === "promotional" ? "promotional" : "transactional",
    channels,
    template_id: template?.id || null,
    whatsapp_body: b.whatsappBody ? str(b.whatsappBody, 4096) : null,
    email_subject: b.emailSubject ? str(b.emailSubject, 255) : null,
    email_html: b.emailHtml ? str(b.emailHtml, 100000) : null,
    attachments,
    variables,
    audience,
    status: later ? "scheduled" : "queued",
    scheduled_at: scheduledAt,
    recurrence,
    next_run_at: later ? scheduledAt || new Date() : null,
  });

  if (later) {
    return res.status(201).json({
      success: true,
      message: recurrence ? "Recurring message scheduled" : `Scheduled for ${scheduledAt!.toLocaleString("en-IN")}`,
      data: { campaign },
    });
  }
  const r = await runCampaign(campaign.id);
  await campaign.reload();
  const deliveries = await MessageDelivery.findAll({ where: { campaign_id: campaign.id }, attributes: ["status", "channel"] });
  const skipped = deliveries.filter((d) => d.status === "skipped").length;
  return res.status(201).json({
    success: true,
    message: `Sending ${r.deliveries - skipped} message${r.deliveries - skipped === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}`,
    data: { campaign, queued: r.deliveries - skipped, skipped },
  });
}

function statsOf(rows: MessageDelivery[]) {
  const s: any = { total: rows.length, whatsapp: 0, email: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, cancelled: 0 };
  for (const d of rows) {
    s[d.channel]++;
    const k = d.status === "sending" ? "queued" : d.status;
    s[k] = (s[k] || 0) + 1;
  }
  return s;
}

export async function listCampaigns(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const rows = await MessageCampaign.findAll({
    where: { owner_id: ownerId, shop_id: shopId },
    include: [{ model: MessageTemplate, as: "template", attributes: ["id", "name"], required: false }],
    order: [["created_at", "DESC"]],
    limit: Math.min(100, Number(req.query.limit) || 50),
  });
  const deliveries = rows.length
    ? await MessageDelivery.findAll({ where: { campaign_id: { [Op.in]: rows.map((r) => r.id) } }, attributes: ["campaign_id", "status", "channel"] })
    : [];
  const by = new Map<number, MessageDelivery[]>();
  for (const d of deliveries) by.set(d.campaign_id!, [...(by.get(d.campaign_id!) || []), d]);
  return res.json({
    success: true,
    data: rows.map((c) => ({ ...c.toJSON(), audience: undefined, stats: statsOf(by.get(c.id) || []) })),
  });
}

export async function getCampaign(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const c = await MessageCampaign.findOne({
    where: { id: Number(req.params.id), owner_id: ownerId, shop_id: shopId },
    include: [{ model: MessageTemplate, as: "template", attributes: ["id", "name"], required: false }],
  });
  if (!c) return fail(res, 404, "Message not found");
  const deliveries = await MessageDelivery.findAll({ where: { campaign_id: c.id }, order: [["id", "ASC"]] });
  return res.json({ success: true, data: { ...c.toJSON(), content: await campaignContent(c), stats: statsOf(deliveries), deliveries: deliveries.map(publicDelivery) } });
}

export async function cancelCampaign(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const c = await MessageCampaign.findOne({ where: { id: Number(req.params.id), owner_id: ownerId, shop_id: shopId } });
  if (!c) return fail(res, 404, "Message not found");
  if (["completed", "cancelled"].includes(c.status) && !c.recurrence) {
    const [n] = await MessageDelivery.update({ status: "cancelled", failure_reason: "Cancelled by sender" }, { where: { campaign_id: c.id, status: "queued" } });
    return res.json({ success: true, message: n ? `Stopped ${n} pending message${n === 1 ? "" : "s"}` : "Nothing left to cancel" });
  }
  await c.update({ status: "cancelled", next_run_at: null });
  await MessageDelivery.update({ status: "cancelled", failure_reason: "Cancelled by sender" }, { where: { campaign_id: c.id, status: "queued" } });
  return res.json({ success: true, message: "Cancelled" });
}

/* ---------------- History ---------------- */

function publicDelivery(d: MessageDelivery) {
  const j: any = d.toJSON();
  return {
    id: j.id,
    source: "messaging",
    campaignId: j.campaign_id,
    customerId: j.customer_id,
    customerName: j.recipient_name || j.customer?.name || null,
    channel: j.channel,
    recipient: j.recipient,
    messageType: j.message_type,
    eventType: j.event_type,
    templateId: j.template_id,
    templateName: j.template?.name || null,
    subject: j.subject,
    body: j.body,
    status: j.status,
    failureReason: j.failure_reason,
    attempts: j.attempts,
    sentAt: j.sent_at,
    deliveredAt: j.delivered_at,
    readAt: j.read_at,
    createdAt: j.created_at ?? j.createdAt,
    groupKey: j.campaign_id ? `c${j.campaign_id}:${j.customer_id}` : j.dedupe_key ? j.dedupe_key.replace(/:(whatsapp|email)$/, "") : `d${j.id}`,
    log: j.log || [],
  };
}

export async function getHistory(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const page = Math.max(1, Number(req.query.page) || 1);
  const channel = String(req.query.channel || "");
  const status = String(req.query.status || "");
  const q = String(req.query.search || "").trim();
  const customerId = Number(req.query.customerId) || null;
  const take = page * limit;

  const where: any = { owner_id: ownerId, shop_id: shopId };
  if (channel === "whatsapp" || channel === "email") where.channel = channel;
  if (status) where.status = status === "queued" ? { [Op.in]: ["queued", "sending"] } : status;
  if (customerId) where.customer_id = customerId;
  if (q) where[Op.or] = [{ recipient_name: { [Op.iLike]: `%${q}%` } }, { subject: { [Op.iLike]: `%${q}%` } }, { body: { [Op.iLike]: `%${q}%` } }];

  const [deliveries, total] = await Promise.all([
    MessageDelivery.findAll({
      where,
      include: [{ model: MessageTemplate, as: "template", attributes: ["id", "name"], required: false }],
      order: [["created_at", "DESC"], ["id", "DESC"]],
      limit: take,
    }),
    MessageDelivery.count({ where }),
  ]);
  let items: any[] = deliveries.map(publicDelivery);

  // Existing system emails (bill, payment receipt, reminders) are part of the same history
  let legacyTotal = 0;
  if (channel !== "whatsapp" && (!status || ["sent", "delivered", "failed", "skipped", "queued"].includes(status))) {
    const lw: any = { owner_id: ownerId, shop_id: shopId };
    if (status) lw.status = status === "sent" || status === "delivered" ? "delivered" : status === "queued" ? "pending" : status;
    if (customerId) lw.customer_id = customerId;
    if (q) lw[Op.or] = [{ recipient_name: { [Op.iLike]: `%${q}%` } }, { subject: { [Op.iLike]: `%${q}%` } }];
    try {
      const [legacy, lt] = await Promise.all([
        EmailNotification.findAll({ where: lw, order: [["created_at", "DESC"]], limit: take }),
        EmailNotification.count({ where: lw }),
      ]);
      legacyTotal = lt;
      items = items.concat(
        legacy.map((e: any) => {
          const j = e.toJSON();
          return {
            id: `e${j.id}`,
            source: "system_email",
            campaignId: null,
            customerId: j.customer_id,
            customerName: j.recipient_name,
            channel: "email",
            recipient: j.recipient_email,
            messageType: "transactional",
            eventType: j.notification_type,
            templateId: null,
            templateName: "System email",
            subject: j.subject,
            body: j.payload?.textSnippet || null,
            status: j.status === "delivered" ? "sent" : j.status === "pending" ? "queued" : j.status,
            failureReason: j.error_message,
            attempts: j.attempts,
            sentAt: j.sent_at ?? j.sentAt ?? null,
            deliveredAt: null,
            readAt: null,
            createdAt: j.created_at ?? j.createdAt,
            groupKey: `e${j.id}`,
            log: [],
          };
        })
      );
    } catch {
      /* legacy table missing — skip */
    }
  }
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pageItems = items.slice((page - 1) * limit, page * limit);
  return res.json({
    success: true,
    data: pageItems,
    pagination: { page, limit, total: total + legacyTotal, pages: Math.max(1, Math.ceil((total + legacyTotal) / limit)) },
  });
}

export async function retryDelivery(req: Request, res: Response) {
  const { ownerId, shopId } = ctx(req);
  const d = await MessageDelivery.findOne({ where: { id: Number(req.params.id), owner_id: ownerId, shop_id: shopId } });
  if (!d) return fail(res, 404, "Message not found");
  if (d.status !== "failed") return fail(res, 400, "Only failed messages can be retried");
  const log = [...((d.log as any[]) || []), { at: new Date().toISOString(), event: "manual_retry" }];
  await d.update({ status: "queued", next_attempt_at: new Date(), max_attempts: d.attempts + 1, log });
  kickQueue();
  return res.json({ success: true, message: "Retrying" });
}

/* ---------------- Customer preferences (owner side) ---------------- */

function publicPref(p: CustomerMessagePreference) {
  return {
    allowWhatsapp: p.allow_whatsapp,
    allowEmail: p.allow_email,
    promoWhatsapp: p.promo_whatsapp,
    promoEmail: p.promo_email,
    whatsappNumber: p.whatsapp_number || "",
    dateOfBirth: p.date_of_birth || "",
    optedOutAt: p.opted_out_at,
  };
}

function applyPrefPatch(b: any) {
  const patch: any = {};
  for (const [k, col] of [
    ["allowWhatsapp", "allow_whatsapp"],
    ["allowEmail", "allow_email"],
    ["promoWhatsapp", "promo_whatsapp"],
    ["promoEmail", "promo_email"],
  ] as const) {
    if (b[k] !== undefined) patch[col] = !!b[k];
  }
  if (patch.promo_whatsapp === false || patch.promo_email === false) patch.opted_out_at = new Date();
  return patch;
}

export async function getCustomerPreferences(req: Request, res: Response) {
  const { ownerId } = ctx(req);
  const customer = await Customer.findOne({ where: { id: Number(req.params.customerId), owner_id: ownerId } });
  if (!customer) return fail(res, 404, "Customer not found");
  const p = (await getPreference(ownerId, customer.id))!;
  return res.json({ success: true, data: publicPref(p) });
}

export async function updateCustomerPreferences(req: Request, res: Response) {
  const { ownerId } = ctx(req);
  const customer = await Customer.findOne({ where: { id: Number(req.params.customerId), owner_id: ownerId } });
  if (!customer) return fail(res, 404, "Customer not found");
  const b = req.body || {};
  const p = (await getPreference(ownerId, customer.id))!;
  const patch = applyPrefPatch(b);
  if (b.whatsappNumber !== undefined) {
    const raw = String(b.whatsappNumber || "").trim();
    if (raw && !normalizeWhatsAppNumber(raw)) return fail(res, 400, "WhatsApp number is not valid");
    patch.whatsapp_number = raw || null;
  }
  if (b.dateOfBirth !== undefined) {
    const v = String(b.dateOfBirth || "").trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(res, 400, "Date of birth must be YYYY-MM-DD");
    patch.date_of_birth = v || null;
  }
  await p.update(patch);
  return res.json({ success: true, message: "Preferences saved", data: publicPref(p) });
}

/* ---------------- Public: unsubscribe / preference page ---------------- */

async function prefByToken(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  return CustomerMessagePreference.findOne({ where: { unsubscribe_token: token } });
}

export async function getPublicPreferences(req: Request, res: Response) {
  const p = await prefByToken(String(req.params.token));
  if (!p) return fail(res, 404, "This link is not valid");
  const customer = await Customer.findByPk(p.customer_id, { attributes: ["name"] });
  const shops = await Shop.findAll({ where: { owner_id: p.owner_id }, attributes: ["name"], limit: 3 });
  return res.json({
    success: true,
    data: { firstName: String(customer?.name || "").split(" ")[0], shopName: shops.map((s) => s.name).join(", "), ...publicPref(p), whatsappNumber: undefined, dateOfBirth: undefined },
  });
}

export async function updatePublicPreferences(req: Request, res: Response) {
  const p = await prefByToken(String(req.params.token));
  if (!p) return fail(res, 404, "This link is not valid");
  const patch = applyPrefPatch(req.body || {});
  if (req.body?.unsubscribeAll) {
    patch.promo_whatsapp = false;
    patch.promo_email = false;
    patch.opted_out_at = new Date();
  }
  await p.update(patch);
  return res.json({ success: true, message: "Your preferences are saved", data: { ...publicPref(p), whatsappNumber: undefined, dateOfBirth: undefined } });
}

/* ---------------- Customer portal: own preferences ---------------- */

export async function getMyPreferences(req: Request, res: Response) {
  const c = req.customer!;
  const p = (await getPreference(c.ownerId, c.customerId))!;
  return res.json({ success: true, data: publicPref(p) });
}

export async function updateMyPreferences(req: Request, res: Response) {
  const c = req.customer!;
  const p = (await getPreference(c.ownerId, c.customerId))!;
  const b = req.body || {};
  const patch = applyPrefPatch(b);
  if (b.dateOfBirth !== undefined) {
    const v = String(b.dateOfBirth || "").trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(res, 400, "Date of birth must be YYYY-MM-DD");
    patch.date_of_birth = v || null;
  }
  await p.update(patch);
  return res.json({ success: true, message: "Preferences saved", data: publicPref(p) });
}

/* ---------------- WhatsApp webhook ---------------- */

export async function verifyWebhook(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe" || !token) return res.sendStatus(403);
  const envOk = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const shopOk = await MessagingSettings.findOne({ where: { wa_webhook_verify_token: token } });
  if (!envOk && !shopOk) return res.sendStatus(403);
  return res.status(200).send(String(challenge ?? ""));
}

export async function receiveWebhook(req: Request, res: Response) {
  const body = req.body || {};
  const phoneIds = new Set<string>();
  for (const e of body.entry || []) for (const c of e.changes || []) if (c?.value?.metadata?.phone_number_id) phoneIds.add(String(c.value.metadata.phone_number_id));
  const rows = phoneIds.size ? await MessagingSettings.findAll({ where: { wa_phone_number_id: { [Op.in]: [...phoneIds] } } }) : [];
  const secrets = [
    ...rows.map((r) => decryptSecret(r.wa_app_secret_enc)).filter(Boolean),
    ...(process.env.WHATSAPP_APP_SECRET ? [process.env.WHATSAPP_APP_SECRET] : []),
  ] as string[];
  if (!secrets.length) {
    console.warn("[MESSAGING] WhatsApp webhook rejected: no app secret configured for this number");
    return res.sendStatus(403);
  }
  if (!verifyWebhookSignature((req as any).rawBody, req.get("x-hub-signature-256"), secrets)) return res.sendStatus(401);
  try {
    await handleWhatsAppWebhook(body);
  } catch (err: any) {
    console.warn("[MESSAGING] webhook processing error:", err?.message || err);
  }
  return res.sendStatus(200);
}
