import nodemailer, { type Transporter } from "nodemailer";
import { EmailNotification, type EmailNotificationType, type EmailStatus } from "../models/EmailNotification";
import { Notification } from "../models/Notification";
import { Customer } from "../models/Customer";
import { CustomerAccount } from "../models/CustomerAccount";
import { Shop } from "../models/Shop";

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const first = local[0];
  const last = local[local.length - 1];
  const middle = "*".repeat(Math.min(local.length - 2, 4));
  return `${first}${middle}${last}@${domain}`;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
      auth: { user, pass },
    });
    return transporter;
  }

  return null;
}

export async function isEmailConfigured(shopId?: number): Promise<boolean> {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return true;
  try {
    const targetShopId = shopId || 1;
    const shop = await Shop.findByPk(targetShopId);
    const smtp = (shop?.settings as any)?.smtp;
    if (smtp?.host && smtp?.user && smtp?.pass) return true;
  } catch (_) {}
  return false;
}

export async function getTransporterForShop(shopId?: number): Promise<{ transporter: Transporter; from?: string; shopName?: string } | null> {
  let shopName = "NSYU Business";
  try {
    const targetShopId = shopId || 1;
    const shop = await Shop.findByPk(targetShopId);
    if (shop?.name) shopName = shop.name;

    const envTransporter = getTransporter();
    if (envTransporter) {
      return { transporter: envTransporter, from: process.env.SMTP_FROM, shopName };
    }

    const smtp = (shop?.settings as any)?.smtp;
    if (smtp?.host && smtp?.user && smtp?.pass) {
      const t = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: smtp.secure === true || Number(smtp.port) === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      return { transporter: t, from: smtp.from || smtp.user, shopName };
    }
  } catch (_) {}
  return null;
}

export async function getCustomerContact(customerId: number): Promise<{ email: string | null; name: string; shopId?: number } | null> {
  try {
    const customer = await Customer.findByPk(customerId, {
      include: [{ model: CustomerAccount, as: "account" }],
    });
    if (!customer) return null;
    const email = (customer.email || (customer as any).account?.email || "").trim();
    return {
      email: email && email.includes("@") ? email : null,
      name: customer.name || "Valued Customer",
      shopId: customer.owner_id ? undefined : undefined,
    };
  } catch (err) {
    console.warn(`[MAILER] Error fetching contact for customer ${customerId}:`, err);
    return null;
  }
}

/* ---------------- Dispatch with Tracking & History ---------------- */

export interface TrackedEmailDispatchParams {
  ownerId: number;
  shopId?: number;
  customerId?: number;
  to?: string;
  recipientName?: string;
  notificationType: EmailNotificationType;
  subject: string;
  text: string;
  html: string;
  referenceType?: string;
  referenceId?: number;
  payload?: any;
}

export async function dispatchTrackedEmail(params: TrackedEmailDispatchParams): Promise<{
  success: boolean;
  emailNotificationId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const {
    ownerId,
    shopId = 1,
    customerId,
    notificationType,
    subject,
    text,
    html,
    referenceType,
    referenceId,
    payload,
  } = params;

  let to = params.to?.trim() || "";
  let recipientName = params.recipientName?.trim() || "";

  // If email was not explicitly passed, attempt to fetch from Customer or CustomerAccount
  if (!to && customerId) {
    const contact = await getCustomerContact(customerId);
    if (contact) {
      if (contact.email) to = contact.email;
      if (!recipientName && contact.name) recipientName = contact.name;
    }
  }

  // Gracefully skip and log if recipient email is missing
  if (!to || !to.includes("@")) {
    console.log(`[MAILER SKIP] No email for customer ID ${customerId || "N/A"}. Logging skipped notification.`);
    const skippedRecord = await EmailNotification.create({
      owner_id: ownerId,
      shop_id: shopId,
      customer_id: customerId || null,
      recipient_email: to || "no-email-provided",
      recipient_name: recipientName || null,
      notification_type: notificationType,
      subject,
      status: "skipped",
      attempts: 0,
      max_attempts: 3,
      last_attempt_at: new Date(),
      error_message: "Customer does not have a registered email address",
      reference_type: referenceType || null,
      reference_id: referenceId ? Number(referenceId) : null,
      payload: payload || null,
    });
    return { success: false, skipped: true, emailNotificationId: skippedRecord.id, error: "No recipient email" };
  }

  // Record initial pending log
  let emailLog: EmailNotification;
  try {
    emailLog = await EmailNotification.create({
      owner_id: ownerId,
      shop_id: shopId,
      customer_id: customerId || null,
      recipient_email: to,
      recipient_name: recipientName || null,
      notification_type: notificationType,
      subject,
      status: "pending",
      attempts: 1,
      max_attempts: 3,
      last_attempt_at: new Date(),
      reference_type: referenceType || null,
      reference_id: referenceId ? Number(referenceId) : null,
      payload: { ...payload, textSnippet: text.slice(0, 300) },
    });
  } catch (dbErr: any) {
    console.error("[MAILER DB ERROR] Failed to create email log record:", dbErr.message);
    return { success: false, error: dbErr.message };
  }

  // Retrieve working transporter for shop
  const active = await getTransporterForShop(shopId);
  if (!active) {
    const errMsg = "SMTP configuration not found for shop " + shopId;
    console.warn(`[MAILER FAILED] ${errMsg}`);
    await emailLog.update({ status: "failed", error_message: errMsg });
    return { success: false, error: errMsg, emailNotificationId: emailLog.id };
  }

  const fromSender = active.from || process.env.SMTP_FROM || `"${active.shopName || "NSYU Business"}" <nsyu.mnt@gmail.com>`;

  try {
    console.log(`[MAILER DISPATCH] ✉️ Sending ${notificationType} to ${to} (${subject})...`);
    await active.transporter.sendMail({
      from: fromSender,
      to,
      subject,
      text,
      html,
    });

    await emailLog.update({
      status: "delivered",
      sent_at: new Date(),
      error_message: null,
    });
    console.log(`[MAILER SUCCESS] 🚀 ${notificationType} delivered to ${to} (log ID: ${emailLog.id})`);

    // In-app customer notification backup
    if (customerId) {
      try {
        await Notification.create({
          owner_id: ownerId,
          shop_id: shopId,
          recipient_type: "customer",
          recipient_id: customerId,
          type: notificationType,
          title: subject,
          message: text.slice(0, 480),
          reference_type: referenceType || null,
          reference_id: referenceId ? Number(referenceId) : null,
          is_read: false,
        });
      } catch (notifErr: any) {
        console.warn("[MAILER NOTIF] Could not create in-app notification:", notifErr.message);
      }
    }

    return { success: true, emailNotificationId: emailLog.id };
  } catch (sendErr: any) {
    console.error(`[MAILER SEND ERROR] ❌ Failed to dispatch email to ${to}:`, sendErr.message);
    await emailLog.update({
      status: "failed",
      error_message: sendErr.message || "Unknown SMTP error",
    });
    return { success: false, error: sendErr.message, emailNotificationId: emailLog.id };
  }
}

/* ---------------- Retry Engine ---------------- */

export async function retryEmailNotification(emailNotificationId: number, ownerId: number): Promise<{ success: boolean; message: string }> {
  const log = await EmailNotification.findOne({
    where: { id: emailNotificationId, owner_id: ownerId },
  });

  if (!log) {
    return { success: false, message: "Email notification record not found" };
  }

  if (log.status === "delivered") {
    return { success: true, message: "Email has already been delivered successfully" };
  }

  if (log.attempts >= log.max_attempts) {
    return { success: false, message: `Max delivery attempts (${log.max_attempts}) reached. Cannot retry automatically.` };
  }

  const to = log.recipient_email;
  if (!to || !to.includes("@") || to === "no-email-provided") {
    return { success: false, message: "No valid recipient email address on record" };
  }

  const active = await getTransporterForShop(log.shop_id || 1);
  if (!active) {
    await log.update({
      attempts: log.attempts + 1,
      last_attempt_at: new Date(),
      error_message: "SMTP not configured",
    });
    return { success: false, message: "SMTP configuration missing or invalid" };
  }

  const fromSender = active.from || process.env.SMTP_FROM || `"${active.shopName || "NSYU Business"}" <nsyu.mnt@gmail.com>`;
  const payload = (log.payload || {}) as any;

  try {
    await active.transporter.sendMail({
      from: fromSender,
      to,
      subject: log.subject,
      text: payload.textSnippet || log.subject,
      html: payload.htmlBody || `<p>${log.subject}</p>`,
    });

    await log.update({
      status: "delivered",
      attempts: log.attempts + 1,
      last_attempt_at: new Date(),
      sent_at: new Date(),
      error_message: null,
    });

    return { success: true, message: `Email delivered successfully to ${to} on attempt ${log.attempts}` };
  } catch (err: any) {
    await log.update({
      attempts: log.attempts + 1,
      last_attempt_at: new Date(),
      error_message: err.message,
    });
    return { success: false, message: `Retry failed: ${err.message}` };
  }
}

export async function retryAllFailedEmails(ownerId: number, shopId?: number): Promise<{ attempted: number; succeeded: number; failed: number }> {
  const where: any = {
    owner_id: ownerId,
    status: "failed",
  };
  if (shopId) where.shop_id = shopId;

  const failedLogs = await EmailNotification.findAll({
    where,
    limit: 25,
  });

  let succeeded = 0;
  let failed = 0;

  for (const log of failedLogs) {
    if (log.attempts < log.max_attempts) {
      const res = await retryEmailNotification(log.id, ownerId);
      if (res.success) succeeded++;
      else failed++;
    } else {
      failed++;
    }
  }

  return { attempted: failedLogs.length, succeeded, failed };
}

/* ---------------- 1. New Bill Notification ---------------- */

export interface SendBillEmailParams {
  ownerId: number;
  shopId?: number;
  customerId?: number;
  customerEmail?: string;
  customerName?: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  invoiceDate?: Date | string;
  items?: Array<{
    productName: string;
    quantity: number;
    rate: number;
    totalAmount: number;
  }>;
}

export async function sendBillEmail(params: SendBillEmailParams): Promise<{ success: boolean; emailNotificationId?: number; error?: string; skipped?: boolean }> {
  const {
    ownerId,
    shopId = 1,
    customerId,
    customerEmail,
    customerName,
    invoiceNumber,
    totalAmount,
    paidAmount,
    dueAmount,
    paymentStatus,
    invoiceDate = new Date(),
    items = [],
  } = params;

  let activeShopName = "NSYU Business";
  try {
    const shop = await Shop.findByPk(shopId);
    if (shop?.name) activeShopName = shop.name;
  } catch (_) {}

  const formattedDate = new Date(invoiceDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const statusLabel = String(paymentStatus || "UNPAID").toUpperCase();
  const statusColor = statusLabel === "PAID" ? "#16a34a" : statusLabel === "PARTIAL" || statusLabel === "PARTIALLY_PAID" ? "#d97706" : "#dc2626";

  const itemsRowsHtml = items.length > 0
    ? items
        .map(
          (it) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b;">${it.productName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: center; color: #475569;">${it.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right; color: #475569;">₹${Number(it.rate).toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right; font-weight: 600; color: #0f172a;">₹${Number(it.totalAmount).toFixed(2)}</td>
        </tr>`
        )
        .join("")
    : `
        <tr>
          <td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">Item details available on invoice.</td>
        </tr>`;

  const subject = `Invoice #${invoiceNumber} from ${activeShopName} - ₹${Number(totalAmount).toFixed(2)}`;
  const text = `Hello ${customerName || "Valued Customer"},\n\nYour invoice #${invoiceNumber} for ₹${Number(totalAmount).toFixed(2)} from ${activeShopName} has been generated.\n\nDate: ${formattedDate}\nGrand Total: ₹${Number(totalAmount).toFixed(2)}\nPaid Amount: ₹${Number(paidAmount).toFixed(2)}\nDue Amount: ₹${Number(dueAmount).toFixed(2)}\nStatus: ${statusLabel}\n\nThank you for doing business with us!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: #1e3a8a; padding: 24px 28px; color: #ffffff; }
    .header-top { display: flex; justify-content: space-between; align-items: center; }
    .shop-title { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: ${statusColor}; color: #ffffff; }
    .invoice-sub { font-size: 13px; color: #93c5fd; margin-top: 4px; }
    .content { padding: 24px 28px; }
    .greeting { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
    .intro { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .summary-row:last-child { margin-bottom: 0; }
    .summary-label { color: #64748b; }
    .summary-value { font-weight: 600; color: #0f172a; }
    .table-container { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table-head th { background: #f1f5f9; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #475569; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    .totals-box { border-top: 2px solid #e2e8f0; padding-top: 14px; margin-top: 8px; }
    .total-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .grand-total { font-size: 16px; font-weight: 700; color: #1e3a8a; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }
    .due-amount { color: #dc2626; font-weight: 700; }
    .footer { background: #f8fafc; padding: 18px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <table style="width: 100%;">
        <tr>
          <td>
            <h1 class="shop-title">${activeShopName}</h1>
            <div class="invoice-sub">Tax Invoice #${invoiceNumber}</div>
          </td>
          <td style="text-align: right;">
            <span class="badge">${statusLabel}</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="content">
      <div class="greeting">Hello, ${customerName || "Valued Customer"}</div>
      <div class="intro">
        Thank you for your business. Here is the summary of your invoice generated on <strong>${formattedDate}</strong>.
      </div>

      <div class="summary-card">
        <table style="width: 100%; font-size: 13px;">
          <tr>
            <td style="color: #64748b; padding-bottom: 6px;">Invoice Number:</td>
            <td style="font-weight: 600; text-align: right; padding-bottom: 6px; color: #0f172a;">#${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding-bottom: 6px;">Date:</td>
            <td style="font-weight: 600; text-align: right; padding-bottom: 6px; color: #0f172a;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Payment Status:</td>
            <td style="font-weight: 700; text-align: right; color: ${statusColor};">${statusLabel}</td>
          </tr>
        </table>
      </div>

      <table class="table-container">
        <thead>
          <tr class="table-head">
            <th style="text-align: left;">Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>

      <div class="totals-box">
        <table style="width: 100%; font-size: 13px;">
          <tr>
            <td style="color: #64748b; padding-bottom: 4px;">Subtotal / Grand Total:</td>
            <td style="text-align: right; font-weight: 600; padding-bottom: 4px;">₹${Number(totalAmount).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding-bottom: 4px;">Paid Amount:</td>
            <td style="text-align: right; font-weight: 600; color: #16a34a; padding-bottom: 4px;">₹${Number(paidAmount).toFixed(2)}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="font-size: 15px; font-weight: 700; color: #1e3a8a; padding-top: 8px;">Remaining Due:</td>
            <td style="font-size: 15px; font-weight: 700; text-align: right; color: ${Number(dueAmount) > 0 ? "#dc2626" : "#16a34a"}; padding-top: 8px;">₹${Number(dueAmount).toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="footer">
      <div>Thank you for choosing <strong>${activeShopName}</strong>!</div>
      <div style="margin-top: 4px;">You can track all your bills, ledger, and orders on the NSYU Mobile App.</div>
    </div>
  </div>
</body>
</html>`;

  return dispatchTrackedEmail({
    ownerId,
    shopId,
    customerId,
    to: customerEmail,
    recipientName: customerName,
    notificationType: "bill_created",
    subject,
    text,
    html,
    referenceType: "Sale",
    referenceId: params.items && params.items.length > 0 ? undefined : undefined,
    payload: {
      invoiceNumber,
      totalAmount,
      paidAmount,
      dueAmount,
      paymentStatus,
      htmlBody: html,
    },
  });
}

/* ---------------- 2. Payment Received Confirmation ---------------- */

export interface SendPaymentReceiptEmailParams {
  ownerId: number;
  shopId?: number;
  customerId?: number;
  customerEmail?: string;
  customerName?: string;
  receiptCode?: string;
  amount: number;
  paymentMethod?: string;
  paymentDate?: Date | string;
  invoiceNumber?: string;
  currentBalance?: number;
  notes?: string;
}

export async function sendPaymentReceiptEmail(params: SendPaymentReceiptEmailParams): Promise<{
  success: boolean;
  emailNotificationId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const {
    ownerId,
    shopId = 1,
    customerId,
    customerEmail,
    customerName,
    receiptCode,
    amount,
    paymentMethod = "cash",
    paymentDate = new Date(),
    invoiceNumber,
    currentBalance,
    notes,
  } = params;

  let activeShopName = "NSYU Business";
  try {
    const shop = await Shop.findByPk(shopId);
    if (shop?.name) activeShopName = shop.name;
  } catch (_) {}

  const formattedDate = new Date(paymentDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const methodUpper = String(paymentMethod).toUpperCase();
  const subject = `Payment Received: ₹${Number(amount).toFixed(2)} - ${activeShopName}`;
  const text = `Hello ${customerName || "Valued Customer"},\n\nWe have received your payment of ₹${Number(amount).toFixed(2)} via ${methodUpper}.\n\nReceipt Code: ${receiptCode || "N/A"}\nDate: ${formattedDate}${invoiceNumber ? `\nApplied to Invoice: #${invoiceNumber}` : ""}${currentBalance !== undefined ? `\nCurrent Outstanding Balance: ₹${Number(currentBalance).toFixed(2)}` : ""}\n\nThank you for your prompt payment!\n${activeShopName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: #047857; padding: 24px 28px; color: #ffffff; text-align: center; }
    .shop-title { font-size: 20px; font-weight: 700; margin: 0; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #a7f3d0; color: #065f46; margin-top: 8px; text-transform: uppercase; }
    .content { padding: 28px; }
    .amount-box { background: #ecfdf5; border: 2px dashed #059669; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .amount-label { font-size: 12px; text-transform: uppercase; font-weight: 600; color: #047857; letter-spacing: 0.5px; }
    .amount-value { font-size: 36px; font-weight: 800; color: #065f46; margin-top: 4px; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13.5px; }
    .details-table td { padding: 8px 4px; }
    .details-table .lbl { color: #64748b; width: 45%; }
    .details-table .val { color: #0f172a; font-weight: 600; text-align: right; }
    .balance-box { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 8px; margin-top: 12px; }
    .footer { background: #f8fafc; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="shop-title">${activeShopName}</h1>
      <span class="badge">Payment Confirmation</span>
    </div>

    <div class="content">
      <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">
        Hello, ${customerName || "Valued Customer"}
      </div>
      <div style="font-size: 13px; color: #64748b; margin-bottom: 20px; line-height: 1.5;">
        Your payment has been successfully recorded in our single ledger system.
      </div>

      <div class="amount-box">
        <div class="amount-label">Amount Received</div>
        <div class="amount-value">₹${Number(amount).toFixed(2)}</div>
      </div>

      <table class="details-table">
        ${receiptCode ? `
        <tr>
          <td class="lbl">Receipt / Reference:</td>
          <td class="val">${receiptCode}</td>
        </tr>` : ""}
        <tr>
          <td class="lbl">Payment Date:</td>
          <td class="val">${formattedDate}</td>
        </tr>
        <tr>
          <td class="lbl">Payment Mode:</td>
          <td class="val">${methodUpper}</td>
        </tr>
        ${invoiceNumber ? `
        <tr>
          <td class="lbl">Applied to Invoice:</td>
          <td class="val">#${invoiceNumber}</td>
        </tr>` : ""}
        ${notes ? `
        <tr>
          <td class="lbl">Notes:</td>
          <td class="val">${notes}</td>
        </tr>` : ""}
      </table>

      ${currentBalance !== undefined ? `
      <div class="balance-box">
        <table style="width: 100%; font-size: 13px;">
          <tr>
            <td style="color: #64748b;">Updated Outstanding Balance:</td>
            <td style="text-align: right; font-weight: 700; color: ${Number(currentBalance) > 0 ? "#dc2626" : "#16a34a"};">
              ₹${Number(currentBalance).toFixed(2)}
            </td>
          </tr>
        </table>
      </div>` : ""}
    </div>

    <div class="footer">
      <div>Thank you for your payment!</div>
      <div style="margin-top: 4px;">&copy; ${new Date().getFullYear()} ${activeShopName}. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  return dispatchTrackedEmail({
    ownerId,
    shopId,
    customerId,
    to: customerEmail,
    recipientName: customerName,
    notificationType: "payment_received",
    subject,
    text,
    html,
    referenceType: "Payment",
    referenceId: undefined,
    payload: {
      receiptCode,
      amount,
      paymentMethod,
      invoiceNumber,
      currentBalance,
      htmlBody: html,
    },
  });
}

/* ---------------- 3. Outstanding Payment Reminder ---------------- */

export interface SendOutstandingReminderEmailParams {
  ownerId: number;
  shopId?: number;
  customerId: number;
  customerEmail?: string;
  customerName?: string;
  outstandingBalance: number;
  unpaidBills?: Array<{
    invoiceNumber: string;
    invoiceDate?: Date | string;
    totalAmount: number;
    dueAmount: number;
  }>;
}

export async function sendOutstandingReminderEmail(params: SendOutstandingReminderEmailParams): Promise<{
  success: boolean;
  emailNotificationId?: number;
  skipped?: boolean;
  error?: string;
}> {
  const {
    ownerId,
    shopId = 1,
    customerId,
    customerEmail,
    customerName,
    outstandingBalance,
    unpaidBills = [],
  } = params;

  let activeShopName = "NSYU Business";
  try {
    const shop = await Shop.findByPk(shopId);
    if (shop?.name) activeShopName = shop.name;
  } catch (_) {}

  const subject = `Gentle Payment Reminder: ₹${Number(outstandingBalance).toFixed(2)} due to ${activeShopName}`;

  const billsRowsHtml = unpaidBills.length > 0
    ? unpaidBills
        .map((b) => {
          const d = b.invoiceDate
            ? new Date(b.invoiceDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "N/A";
          return `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #1e293b;">#${b.invoiceNumber}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b;">${d}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right; color: #475569;">₹${Number(b.totalAmount).toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right; font-weight: 700; color: #dc2626;">₹${Number(b.dueAmount).toFixed(2)}</td>
          </tr>`;
        })
        .join("")
    : "";

  const text = `Hello ${customerName || "Valued Customer"},\n\nThis is a friendly reminder regarding your outstanding balance with ${activeShopName}.\n\nTotal Outstanding Balance: ₹${Number(outstandingBalance).toFixed(2)}${unpaidBills.length > 0 ? `\nPending Invoices:\n` + unpaidBills.map(b => `- #${b.invoiceNumber}: Due ₹${b.dueAmount}`).join("\n") : ""}\n\nPlease arrange for payment at your earliest convenience via Cash, UPI or Bank Transfer.\n\nThank you,\n${activeShopName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: #b91c1c; padding: 24px 28px; color: #ffffff; }
    .shop-title { font-size: 20px; font-weight: 700; margin: 0; }
    .sub { font-size: 13px; color: #fecaca; margin-top: 4px; }
    .content { padding: 28px; }
    .reminder-box { background: #fef2f2; border: 2px dashed #ef4444; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .reminder-label { font-size: 12px; text-transform: uppercase; font-weight: 600; color: #991b1b; letter-spacing: 0.5px; }
    .reminder-value { font-size: 36px; font-weight: 800; color: #b91c1c; margin-top: 4px; }
    .table-container { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table-head th { background: #f8fafc; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    .notice { font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 20px; }
    .footer { background: #f8fafc; padding: 18px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="shop-title">${activeShopName}</h1>
      <div class="sub">Payment Reminder & Account Summary</div>
    </div>

    <div class="content">
      <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">
        Dear ${customerName || "Valued Customer"},
      </div>
      <div class="notice">
        We hope you are having a great day. This is a gentle reminder that you currently have an outstanding balance on your account with <strong>${activeShopName}</strong>.
      </div>

      <div class="reminder-box">
        <div class="reminder-label">Total Outstanding Due</div>
        <div class="reminder-value">₹${Number(outstandingBalance).toFixed(2)}</div>
      </div>

      ${unpaidBills.length > 0 ? `
      <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 8px;">Pending Invoices Breakdown:</div>
      <table class="table-container">
        <thead>
          <tr class="table-head">
            <th style="text-align: left;">Invoice</th>
            <th style="text-align: left;">Date</th>
            <th style="text-align: right;">Total</th>
            <th style="text-align: right;">Due</th>
          </tr>
        </thead>
        <tbody>
          ${billsRowsHtml}
        </tbody>
      </table>` : ""}

      <div class="notice">
        Kindly clear the outstanding balance at your earliest convenience. Payments can be made via Cash, UPI, or Bank Transfer at our shop or through our staff. If you have already made this payment recently, please disregard this reminder.
      </div>
    </div>

    <div class="footer">
      <div>Thank you for your ongoing partnership with <strong>${activeShopName}</strong>!</div>
      <div style="margin-top: 4px;">&copy; ${new Date().getFullYear()} ${activeShopName}. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  return dispatchTrackedEmail({
    ownerId,
    shopId,
    customerId,
    to: customerEmail,
    recipientName: customerName,
    notificationType: "payment_reminder",
    subject,
    text,
    html,
    payload: {
      outstandingBalance,
      unpaidBillsCount: unpaidBills.length,
      htmlBody: html,
    },
  });
}

/* ---------------- OTP Email Dispatch (Existing & Preserved) ---------------- */

export interface SendOtpEmailParams {
  to: string;
  customerName?: string;
  otp: string;
  shopName?: string;
  shopId?: number;
}

export async function sendOtpEmail(params: SendOtpEmailParams): Promise<boolean> {
  const { to, customerName, otp, shopName, shopId } = params;
  const storeName = shopName || "NSYU Business";
  const name = customerName || "Valued Customer";

  console.log(`[EMAIL DISPATCH] ✉️ OTP [${otp}] dispatched to ${to} (${name}) for ${storeName}`);

  const active = await getTransporterForShop(shopId);
  if (!active) {
    return false;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your NSYU Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #047857; padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #a7f3d0; }
    .content { padding: 32px 24px; text-align: center; }
    .greeting { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #0f172a; }
    .instructions { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
    .otp-box { background: #f0fdf4; border: 2px dashed #059669; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 0 auto 24px auto; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #047857; margin-left: 12px; font-family: 'Courier New', Courier, monospace; }
    .expiry { font-size: 12px; color: #ea580c; font-weight: 600; margin-bottom: 16px; }
    .warning { font-size: 11.5px; color: #94a3b8; line-height: 1.4; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${storeName}</h1>
      <p>Customer Portal Access</p>
    </div>
    <div class="content">
      <div class="greeting">Hello, ${name}</div>
      <div class="instructions">
        Use the following verification code to log in to your customer portal. This code was requested for your account.
      </div>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <div class="expiry">⏱️ Valid for 5 minutes only</div>
      <div class="warning">
        If you did not request this code, please ignore this email or contact ${storeName} immediately. Never share your verification code with anyone.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;

  try {
    await active.transporter.sendMail({
      from: active.from || process.env.SMTP_FROM || `"${storeName}" <nsyu.mnt@gmail.com>`,
      to,
      subject: `${otp} is your verification code for ${storeName}`,
      text: `Hello ${name},\n\nYour verification code for ${storeName} Customer Portal is: ${otp}\n\nThis code is valid for 5 minutes. Never share this code with anyone.\n\nThank you,\n${storeName}`,
      html,
    });
    console.log(`[EMAIL DISPATCH SUCCESS] ✉️ Real email delivered to ${to} via Gmail SMTP!`);
    return true;
  } catch (err: any) {
    console.error("[EMAIL ERROR] Failed to send email via SMTP:", err.message);
    return false;
  }
}
