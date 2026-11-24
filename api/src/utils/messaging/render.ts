/** Template variables and rendering for WhatsApp (plain text) and Email (HTML). */

export const TEMPLATE_VARIABLES = [
  { key: "customer_name", label: "Customer name" },
  { key: "shop_name", label: "Shop name" },
  { key: "order_number", label: "Order / invoice number" },
  { key: "order_amount", label: "Order / invoice amount" },
  { key: "due_amount", label: "Outstanding amount" },
  { key: "payment_amount", label: "Payment amount" },
  { key: "payment_link", label: "Payment link" },
  { key: "invoice_link", label: "Invoice link" },
  { key: "product_name", label: "Product name" },
  { key: "order_tracking_link", label: "Order tracking link" },
  { key: "due_date", label: "Due date" },
  { key: "festival_name", label: "Festival name" },
  { key: "unsubscribe_link", label: "Unsubscribe link" },
] as const;

export type TemplateVars = Record<string, string | number | null | undefined>;

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Plain-text substitution (WhatsApp, subjects). Unknown variables render as empty strings. */
export function renderText(tpl: string | null | undefined, vars: TemplateVars): string {
  if (!tpl) return "";
  return tpl.replace(VAR_RE, (_m, k) => (vars[k] === undefined || vars[k] === null ? "" : String(vars[k])));
}

const looksLikeHtml = (s: string) => /<\/?(p|div|br|table|a|strong|b|h[1-6]|ul|ol|li|span|img)\b/i.test(s);

/**
 * Email body: values are HTML-escaped; plain-text bodies get paragraphs and clickable links.
 * Authored HTML (from the template editor) is kept as written.
 */
export function renderHtml(tpl: string | null | undefined, vars: TemplateVars): string {
  if (!tpl) return "";
  const escaped: TemplateVars = {};
  for (const [k, v] of Object.entries(vars)) escaped[k] = v === null || v === undefined ? "" : escapeHtml(String(v));
  if (looksLikeHtml(tpl)) return renderText(tpl, escaped);
  const text = renderText(escapeHtml(tpl), escaped);
  const linked = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#047857;font-weight:600">$1</a>');
  return linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Shop-branded wrapper; promotional mail always carries an unsubscribe link. */
export function wrapEmail(opts: { shopName: string; bodyHtml: string; unsubscribeUrl?: string | null; promotional?: boolean }) {
  const shop = escapeHtml(opts.shopName);
  const unsub = opts.unsubscribeUrl
    ? `<div style="margin-top:6px">${opts.promotional ? "Don't want offers from us?" : "Manage how we contact you:"} <a href="${opts.unsubscribeUrl}" style="color:#047857">${opts.promotional ? "Unsubscribe" : "Communication preferences"}</a></div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f2a22">
<div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8e5">
<div style="background:#0b3b2e;padding:20px 26px;color:#ffffff;font-size:18px;font-weight:700">${shop}</div>
<div style="padding:26px;font-size:14px;color:#1e293b">${opts.bodyHtml}</div>
<div style="background:#f7faf9;padding:16px 26px;border-top:1px solid #e2e8e5;font-size:12px;color:#64748b;text-align:center">
<div>Sent by ${shop}</div>${unsub}</div></div></body></html>`;
}

/** Variables that appear in a template string, in first-seen order. */
export function variablesIn(...parts: Array<string | null | undefined>): string[] {
  const seen: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    for (const m of p.matchAll(VAR_RE)) if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}
