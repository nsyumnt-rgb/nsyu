/**
 * Official WhatsApp Business Cloud API client (Meta Graph API).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * WHATSAPP_GRAPH_BASE_URL can point at a local stub for testing; it defaults to Meta's endpoint.
 */
const DEFAULT_VERSION = "v21.0";

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string | null;
  apiVersion?: string | null;
}

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** true when retrying cannot help (bad number, template missing, auth) */
  permanent?: boolean;
}

function base(creds: WhatsAppCredentials) {
  const root = (process.env.WHATSAPP_GRAPH_BASE_URL || "https://graph.facebook.com").replace(/\/+$/, "");
  return `${root}/${creds.apiVersion || DEFAULT_VERSION}`;
}

/** Digits only, with the default country code added to bare 10-digit numbers (India by default). */
export function normalizeWhatsAppNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91") + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

async function graph(creds: WhatsAppCredentials, path: string, init?: { method?: string; body?: any }) {
  const res = await fetch(`${base(creds)}/${path}`, {
    method: init?.method || "GET",
    headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function toResult(status: number, json: any): WhatsAppSendResult {
  if (status >= 200 && status < 300 && json?.messages?.[0]?.id) {
    return { ok: true, messageId: json.messages[0].id };
  }
  const e = json?.error || {};
  const msg = [e.message, e.error_data?.details].filter(Boolean).join(" — ") || `WhatsApp API HTTP ${status}`;
  // 4xx other than rate limits are not fixed by retrying (bad number, template, auth, 24h window)
  const permanent = status >= 400 && status < 500 && status !== 429 && e.code !== 130429 && e.code !== 131056;
  return { ok: false, error: e.code ? `${msg} (code ${e.code})` : msg, permanent };
}

export async function sendWhatsAppText(creds: WhatsAppCredentials, to: string, body: string): Promise<WhatsAppSendResult> {
  try {
    const { status, json } = await graph(creds, `${creds.phoneNumberId}/messages`, {
      method: "POST",
      body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body } },
    });
    return toResult(status, json);
  } catch (err: any) {
    return { ok: false, error: err?.message || "WhatsApp request failed" };
  }
}

export async function sendWhatsAppTemplate(
  creds: WhatsAppCredentials,
  to: string,
  template: { name: string; language: string; params: string[] }
): Promise<WhatsAppSendResult> {
  try {
    const components = template.params.length
      ? [{ type: "body", parameters: template.params.map((text) => ({ type: "text", text: text || "-" })) }]
      : [];
    const { status, json } = await graph(creds, `${creds.phoneNumberId}/messages`, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template.name, language: { code: template.language || "en" }, components },
      },
    });
    return toResult(status, json);
  } catch (err: any) {
    return { ok: false, error: err?.message || "WhatsApp request failed" };
  }
}

export async function sendWhatsAppDocument(creds: WhatsAppCredentials, to: string, url: string, filename: string): Promise<WhatsAppSendResult> {
  try {
    const { status, json } = await graph(creds, `${creds.phoneNumberId}/messages`, {
      method: "POST",
      body: { messaging_product: "whatsapp", to, type: "document", document: { link: url, filename } },
    });
    return toResult(status, json);
  } catch (err: any) {
    return { ok: false, error: err?.message || "WhatsApp request failed" };
  }
}

/** Confirms the credentials work and returns the number's display details. */
export async function verifyWhatsAppCredentials(creds: WhatsAppCredentials) {
  try {
    const { status, json } = await graph(creds, `${creds.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`);
    if (status >= 200 && status < 300) {
      return { ok: true, displayNumber: json.display_phone_number as string, verifiedName: json.verified_name as string, quality: json.quality_rating };
    }
    return { ok: false, error: json?.error?.message || `HTTP ${status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Could not reach WhatsApp" };
  }
}

/** Approved message templates on the WhatsApp Business Account. */
/** Submits a message template to Meta for approval (status starts as PENDING). */
export async function createWhatsAppTemplate(
  creds: WhatsAppCredentials,
  t: { name: string; language: string; category: "UTILITY" | "MARKETING"; text: string; examples: string[] }
): Promise<{ ok: boolean; status?: string; exists?: boolean; error?: string }> {
  if (!creds.businessAccountId) return { ok: false, error: "WhatsApp Business Account ID is not set" };
  try {
    const body: any = { type: "BODY", text: t.text };
    if (t.examples.length) body.example = { body_text: [t.examples] };
    const { status, json } = await graph(creds, `${creds.businessAccountId}/message_templates`, {
      method: "POST",
      body: { name: t.name, language: t.language, category: t.category, components: [body] },
    });
    if (status >= 200 && status < 300 && json?.id) return { ok: true, status: json.status || "PENDING" };
    const e = json?.error || {};
    const msg = [e.error_user_msg || e.message, e.error_data?.details].filter(Boolean).join(" — ") || `HTTP ${status}`;
    // Same name already submitted earlier: keep using it
    if (/already exists|duplicate/i.test(msg) || e.error_subcode === 2388024) return { ok: true, exists: true, status: "EXISTS" };
    return { ok: false, error: msg };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Could not reach WhatsApp" };
  }
}

export async function listApprovedTemplates(creds: WhatsAppCredentials) {
  if (!creds.businessAccountId) return { ok: false, error: "WhatsApp Business Account ID is not set", templates: [] as any[] };
  try {
    const { status, json } = await graph(
      creds,
      `${creds.businessAccountId}/message_templates?fields=name,language,status,category,components&limit=200`
    );
    if (status < 200 || status >= 300) return { ok: false, error: json?.error?.message || `HTTP ${status}`, templates: [] };
    const templates = (json.data || []).map((t: any) => {
      const body = (t.components || []).find((c: any) => c.type === "BODY");
      const text: string = body?.text || "";
      const paramCount = new Set((text.match(/\{\{\d+\}\}/g) || [])).size;
      return { name: t.name, language: t.language, status: t.status, category: t.category, body: text, paramCount };
    });
    return { ok: true, templates };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Could not reach WhatsApp", templates: [] };
  }
}
