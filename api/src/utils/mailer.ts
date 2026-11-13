import nodemailer, { type Transporter } from "nodemailer";

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
    const { Shop } = require("../models");
    const targetShopId = shopId || 1;
    const shop = await Shop.findByPk(targetShopId);
    const smtp = (shop?.settings as any)?.smtp;
    if (smtp?.host && smtp?.user && smtp?.pass) return true;
  } catch (_) {}
  return false;
}

export async function getTransporterForShop(shopId?: number): Promise<{ transporter: Transporter; from?: string } | null> {
  const envTransporter = getTransporter();
  if (envTransporter) return { transporter: envTransporter, from: process.env.SMTP_FROM };

  try {
    const { Shop } = require("../models");
    const targetShopId = shopId || 1;
    const shop = await Shop.findByPk(targetShopId);
    const smtp = (shop?.settings as any)?.smtp;
    if (smtp?.host && smtp?.user && smtp?.pass) {
      const t = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: smtp.secure === true || Number(smtp.port) === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      return { transporter: t, from: smtp.from || smtp.user };
    }
  } catch (_) {}
  return null;
}

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

  console.log(`[EMAIL DISPATCH] ✉️  OTP [${otp}] dispatched to ${to} (${name}) for ${storeName}`);

  const active = await getTransporterForShop(shopId);
  if (!active) {
    // No external SMTP configured
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
      from: active.from || process.env.SMTP_FROM || `"${storeName}" <no-reply@nsyu.local>`,
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
