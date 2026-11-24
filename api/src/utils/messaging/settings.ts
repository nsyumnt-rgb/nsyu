import { MessagingSettings, AUTOMATION_EVENTS, type AutomationEvent, type AutomationRule } from "../../models/Messaging";

/**
 * Defaults keep today's behaviour: invoice and payment-receipt emails stay ON (they are the
 * existing Gmail/SMTP emails), everything else is OFF until the shop owner switches it on.
 */
export const DEFAULT_AUTOMATIONS: Record<AutomationEvent, AutomationRule> = {
  customer_registration: { whatsapp: false, email: false },
  order_confirmed: { whatsapp: false, email: false },
  order_dispatched: { whatsapp: false, email: false },
  order_delivered: { whatsapp: false, email: false },
  payment_received: { whatsapp: false, email: true },
  pending_payment: { whatsapp: false, email: false, days: 7 },
  due_date_reminder: { whatsapp: false, email: false, days: 3 },
  invoice_generated: { whatsapp: false, email: true },
  offers_promotions: { whatsapp: false, email: false },
  birthday_greeting: { whatsapp: false, email: false },
  festival_greeting: { whatsapp: false, email: false },
};

/** Events whose email already exists in utils/mailer.ts (bill + payment receipt). */
export const LEGACY_EMAIL_EVENTS: AutomationEvent[] = ["invoice_generated", "payment_received"];

export function resolveRules(row?: MessagingSettings | null): Record<AutomationEvent, AutomationRule> {
  const saved = (row?.automations || {}) as Record<string, Partial<AutomationRule>>;
  const out = {} as Record<AutomationEvent, AutomationRule>;
  for (const ev of AUTOMATION_EVENTS) {
    const s = saved[ev] || {};
    out[ev] = {
      ...DEFAULT_AUTOMATIONS[ev],
      ...s,
      whatsapp: s.whatsapp ?? DEFAULT_AUTOMATIONS[ev].whatsapp,
      email: s.email ?? DEFAULT_AUTOMATIONS[ev].email,
    };
  }
  return out;
}

export async function getSettingsRow(shopId: number): Promise<MessagingSettings | null> {
  try {
    return await MessagingSettings.findOne({ where: { shop_id: shopId } });
  } catch {
    return null; // table not there yet (older DB) — behave exactly as before
  }
}

/**
 * Used by the existing bill / payment-receipt emails. They still send by default; the owner
 * can turn them off, or replace them with their own template, from Messaging → Automations.
 */
export async function legacyEmailAllowed(shopId: number | undefined, event: AutomationEvent): Promise<boolean> {
  if (!shopId) return true;
  const row = await getSettingsRow(shopId);
  if (!row) return true;
  if (row.email_enabled === false) return false;
  const rule = resolveRules(row)[event];
  return !!rule.email && !rule.templateId;
}
