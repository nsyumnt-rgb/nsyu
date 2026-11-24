import { DEFAULT_EVENT_CONTENT } from "./engine";
import type { AutomationEvent } from "../../models/Messaging";
import { PROMOTIONAL_EVENTS } from "../../models/Messaging";

/**
 * Ready-made templates a shop can add in one click (Messaging › Templates).
 * One per automation event (same wording as the built-in automation text, so adding
 * them changes nothing until the owner edits them), plus everyday extras.
 * Only variables from TEMPLATE_VARIABLES are used.
 */
export interface StarterTemplate {
  key: string;
  name: string;
  category: string;
  messageType: "transactional" | "promotional";
  /** Automation this template is used for, if any */
  event?: AutomationEvent;
  whatsappBody: string;
  emailSubject: string;
  emailHtml: string;
}

const EVENT_META: Record<AutomationEvent, { name: string; category: string }> = {
  customer_registration: { name: "Welcome new customer", category: "welcome" },
  order_confirmed: { name: "Order confirmed", category: "orders" },
  order_dispatched: { name: "Order dispatched", category: "orders" },
  order_delivered: { name: "Order delivered", category: "orders" },
  payment_received: { name: "Payment received", category: "payments" },
  pending_payment: { name: "Pending payment reminder", category: "reminders" },
  due_date_reminder: { name: "Due date reminder", category: "reminders" },
  invoice_generated: { name: "Invoice / bill ready", category: "invoices" },
  offers_promotions: { name: "New offer", category: "offers" },
  birthday_greeting: { name: "Birthday wishes", category: "greetings" },
  festival_greeting: { name: "Festival wishes", category: "greetings" },
};

const EXTRAS: StarterTemplate[] = [
  {
    key: "thank_you_purchase",
    name: "Thank you for shopping",
    category: "invoices",
    messageType: "transactional",
    whatsappBody: "Hi {{customer_name}}, thank you for shopping at {{shop_name}}! Your bill {{order_number}} for {{order_amount}} is here: {{invoice_link}}\nSee you again soon.",
    emailSubject: "Thank you for shopping at {{shop_name}}",
    emailHtml: "Hi {{customer_name}},\n\nThank you for shopping at {{shop_name}}!\n\nYour bill {{order_number}} for {{order_amount}}: {{invoice_link}}\n\nWe look forward to seeing you again.",
  },
  {
    key: "account_statement",
    name: "Account balance update",
    category: "payments",
    messageType: "transactional",
    whatsappBody: "Hi {{customer_name}}, your current balance with {{shop_name}} is {{due_amount}}. You can pay here: {{payment_link}}\nThank you!",
    emailSubject: "Your balance with {{shop_name}}",
    emailHtml: "Hi {{customer_name}},\n\nYour current balance with {{shop_name}} is {{due_amount}}.\n\nPay online: {{payment_link}}\n\nIf you have any questions about your account, just reply to this email.",
  },
  {
    key: "final_payment_reminder",
    name: "Final payment reminder",
    category: "reminders",
    messageType: "transactional",
    whatsappBody: "Hi {{customer_name}}, {{due_amount}} is still pending with {{shop_name}} after earlier reminders. Please pay by {{due_date}} here: {{payment_link}}\nThank you.",
    emailSubject: "Final reminder: {{due_amount}} pending",
    emailHtml: "Hi {{customer_name}},\n\nOur records show {{due_amount}} is still pending after earlier reminders.\n\nPlease pay by {{due_date}}: {{payment_link}}\n\nIf you have already paid, please ignore this message and accept our thanks.",
  },
  {
    key: "feedback_request",
    name: "Feedback request",
    category: "general",
    messageType: "transactional",
    whatsappBody: "Hi {{customer_name}}, thank you for your order {{order_number}} from {{shop_name}}. How was your experience? Just reply to this message, we read every reply.",
    emailSubject: "How was your order {{order_number}}?",
    emailHtml: "Hi {{customer_name}},\n\nThank you for your order {{order_number}} from {{shop_name}}.\n\nHow was your experience? Just reply to this email. We read every reply.",
  },
  {
    key: "new_arrivals",
    name: "New stock arrived",
    category: "offers",
    messageType: "promotional",
    whatsappBody: "Hi {{customer_name}}, new stock has arrived at {{shop_name}}: {{product_name}}. Visit us or order online today!",
    emailSubject: "New at {{shop_name}}: {{product_name}}",
    emailHtml: "Hi {{customer_name}},\n\nNew stock has just arrived at {{shop_name}}: {{product_name}}.\n\nVisit us or order online today!\n\nTo stop offer emails: {{unsubscribe_link}}",
  },
  {
    key: "sale_discount",
    name: "Sale / discount offer",
    category: "offers",
    messageType: "promotional",
    whatsappBody: "Hi {{customer_name}}, special sale at {{shop_name}}! {{product_name}}. Offer for a limited time only, visit us soon.",
    emailSubject: "Special sale at {{shop_name}}",
    emailHtml: "Hi {{customer_name}},\n\nSpecial sale at {{shop_name}}: {{product_name}}.\n\nThe offer is for a limited time only, so visit us soon!\n\nTo stop offer emails: {{unsubscribe_link}}",
  },
  {
    key: "back_in_stock",
    name: "Back in stock",
    category: "offers",
    messageType: "promotional",
    whatsappBody: "Hi {{customer_name}}, good news! {{product_name}} is back in stock at {{shop_name}}. Order soon before it runs out.",
    emailSubject: "{{product_name}} is back in stock",
    emailHtml: "Hi {{customer_name}},\n\nGood news! {{product_name}} is back in stock at {{shop_name}}.\n\nOrder soon before it runs out.\n\nTo stop offer emails: {{unsubscribe_link}}",
  },
  {
    key: "shop_notice",
    name: "Shop timing / holiday notice",
    category: "general",
    messageType: "promotional",
    whatsappBody: "Hi {{customer_name}}, a quick update from {{shop_name}}: our shop timings change for {{festival_name}}. Thank you for your support!",
    emailSubject: "Shop timings update from {{shop_name}}",
    emailHtml: "Hi {{customer_name}},\n\nA quick update from {{shop_name}}: our shop timings change for {{festival_name}}.\n\nThank you for your support!\n\nTo stop these emails: {{unsubscribe_link}}",
  },
];

export const STARTER_TEMPLATES: StarterTemplate[] = [
  ...(Object.keys(EVENT_META) as AutomationEvent[]).map((event) => {
    const c = DEFAULT_EVENT_CONTENT[event];
    return {
      key: event,
      name: EVENT_META[event].name,
      category: EVENT_META[event].category,
      messageType: PROMOTIONAL_EVENTS.includes(event) ? ("promotional" as const) : ("transactional" as const),
      event,
      whatsappBody: c.whatsappBody || "",
      emailSubject: c.emailSubject || "",
      emailHtml: c.emailHtml || "",
    };
  }),
  ...EXTRAS,
];

/* ---------------- WhatsApp (Meta) template format ---------------- */

const EXAMPLES: Record<string, string> = {
  customer_name: "Ravi Kumar",
  shop_name: "Sharma Electronics",
  order_number: "INV-1024",
  order_amount: "₹1,250.00",
  due_amount: "₹500.00",
  payment_amount: "₹750.00",
  payment_link: "https://nsyu.in/#/pay/123",
  invoice_link: "https://nsyu.in/#/invoice/123",
  product_name: "LED bulbs 9W",
  order_tracking_link: "https://nsyu.in/#/orders/123",
  due_date: "30 Nov 2026",
  festival_name: "Diwali",
  unsubscribe_link: "https://nsyu.in/#/preferences/abc",
};

/**
 * Converts "Hi {{customer_name}} …" into Meta's numbered form "Hi {{1}} …" with example
 * values, and the list of NSYU variables to send as parameters, in order.
 * Meta rejects bodies that start or end with a variable, so those get a few words added.
 */
export function toWhatsAppTemplateBody(body: string): { text: string; params: string[]; examples: string[] } {
  let text = body.trim();
  if (/^\{\{/.test(text)) text = `Hello, ${text}`;
  if (/\}\}\s*[.!]?\s*$/.test(text)) text = text.replace(/\s*[.!]?\s*$/, "") + "\nThank you.";
  const order: string[] = [];
  const out = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => {
    let i = order.indexOf(k);
    if (i < 0) {
      order.push(k);
      i = order.length - 1;
    }
    return `{{${i + 1}}}`;
  });
  return { text: out.slice(0, 1024), params: order.map((k) => `{{${k}}}`), examples: order.map((k) => EXAMPLES[k] || "sample") };
}

/** Meta template names: lowercase letters, digits and underscores. */
export function whatsAppTemplateName(name: string, id: number): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "template";
  return `nsyu_${base}_${id}`;
}
