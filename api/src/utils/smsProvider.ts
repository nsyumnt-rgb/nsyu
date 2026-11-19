/**
 * NSYU SMS & WhatsApp Dispatch Service.
 * Pluggable provider architecture supporting:
 * 1. Twilio (via TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
 * 2. MSG91 (via MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID)
 * 3. Generic Webhook / HTTP SMS gateway (via SMS_WEBHOOK_URL, SMS_API_KEY)
 * 4. Development / Test log mode (graceful fallback when credentials are not configured)
 */

export interface SmsMessageOptions {
  toPhone: string;
  customerName?: string;
  message: string;
  shopName?: string;
  type?: "payment_reminder" | "order_status" | "otp";
}

export interface SmsSendResult {
  success: boolean;
  provider: "twilio" | "msg91" | "webhook" | "mock" | "disabled";
  messageId?: string;
  error?: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ||
      process.env.MSG91_AUTH_KEY ||
      process.env.SMS_WEBHOOK_URL
  );
}

/**
 * Normalizes phone number to standard format with country code (defaults to +91 India).
 */
export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * Sends an SMS or WhatsApp notification to a customer.
 */
export async function sendSmsNotification(options: SmsMessageOptions): Promise<SmsSendResult> {
  const { toPhone, message, customerName, shopName } = options;
  const formattedPhone = formatPhoneNumber(toPhone);

  // 1. Twilio
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const body = new URLSearchParams({
        To: formattedPhone,
        From: process.env.TWILIO_PHONE_NUMBER,
        Body: message,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        return { success: true, provider: "twilio", messageId: data.sid };
      }
      return { success: false, provider: "twilio", error: data.message || "Twilio dispatch failed" };
    } catch (err: any) {
      return { success: false, provider: "twilio", error: err.message };
    }
  }

  // 2. MSG91
  if (process.env.MSG91_AUTH_KEY) {
    try {
      const url = "https://api.msg91.com/api/v5/flow/";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID || "",
          short_url: "0",
          recipients: [
            {
              mobiles: formattedPhone.replace("+", ""),
              name: customerName || "Customer",
              shop: shopName || "Shop",
              msg: message,
            },
          ],
        }),
      });

      const data = (await res.json()) as any;
      return {
        success: data.type === "success",
        provider: "msg91",
        messageId: data.request_id,
        error: data.type !== "success" ? data.message : undefined,
      };
    } catch (err: any) {
      return { success: false, provider: "msg91", error: err.message };
    }
  }

  // 3. Generic Webhook SMS Gateway
  if (process.env.SMS_WEBHOOK_URL) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.SMS_API_KEY) headers["Authorization"] = `Bearer ${process.env.SMS_API_KEY}`;

      const res = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: formattedPhone,
          message,
          customerName,
          shopName,
          type: options.type || "general",
        }),
      });

      if (res.ok) {
        return { success: true, provider: "webhook" };
      }
      return { success: false, provider: "webhook", error: `Webhook returned status ${res.status}` };
    } catch (err: any) {
      return { success: false, provider: "webhook", error: err.message };
    }
  }

  // 4. Development / Testing / Unconfigured Fallback
  if (process.env.NODE_ENV === "test") {
    return { success: true, provider: "mock", messageId: "mock-sms-id" };
  }

  // Graceful no-op when not configured in production
  return {
    success: false,
    provider: "disabled",
    error: "SMS provider is not configured. Set TWILIO_ACCOUNT_SID or MSG91_AUTH_KEY to enable live SMS.",
  };
}
