import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

/**
 * Centralised WhatsApp + Email messaging (per shop, tenant-isolated by owner_id + shop_id).
 *
 *  messaging_settings              one row per shop — channel config + automation switches
 *  message_templates               reusable templates with separate WhatsApp and Email content
 *  message_campaigns               one "send" (single customer, group, automation or recurring)
 *  message_deliveries              one row per recipient per channel — status, retries, failures
 *  customer_message_preferences    channel choice, promotional consent, unsubscribe token
 *
 * Customers are NOT duplicated: every row points at the existing customers table.
 */

export const MESSAGE_CHANNELS = ["whatsapp", "email"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export type ChannelSelection = "whatsapp" | "email" | "both";

export const AUTOMATION_EVENTS = [
  "customer_registration",
  "order_confirmed",
  "order_dispatched",
  "order_delivered",
  "payment_received",
  "pending_payment",
  "due_date_reminder",
  "invoice_generated",
  "offers_promotions",
  "birthday_greeting",
  "festival_greeting",
] as const;
export type AutomationEvent = (typeof AUTOMATION_EVENTS)[number];

/** Promotional events require promotional consent; the rest are transactional. */
export const PROMOTIONAL_EVENTS: AutomationEvent[] = ["offers_promotions", "birthday_greeting", "festival_greeting"];

export type DeliveryStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "skipped" | "cancelled";

export interface AutomationRule {
  whatsapp: boolean;
  email: boolean;
  templateId?: number | null;
  /** due_date_reminder: days before the due date; pending_payment: repeat every N days */
  days?: number;
}

export class MessagingSettings extends Model {
  declare id: number;
  declare owner_id: number;
  declare shop_id: number;
  declare whatsapp_enabled: boolean;
  declare wa_phone_number_id: string | null;
  declare wa_business_account_id: string | null;
  declare wa_display_number: string | null;
  declare wa_access_token_enc: string | null;
  declare wa_app_secret_enc: string | null;
  declare wa_webhook_verify_token: string | null;
  declare wa_api_version: string | null;
  declare email_enabled: boolean;
  declare email_sender_name: string | null;
  declare email_sender_address: string | null;
  declare email_reply_to: string | null;
  declare automations: Record<string, AutomationRule> | null;
  declare festivals: Array<{ name: string; date: string }> | null;
  declare credit_days: number;
}

MessagingSettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    whatsapp_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    wa_phone_number_id: { type: DataTypes.STRING(64), allowNull: true },
    wa_business_account_id: { type: DataTypes.STRING(64), allowNull: true },
    wa_display_number: { type: DataTypes.STRING(32), allowNull: true },
    wa_access_token_enc: { type: DataTypes.TEXT, allowNull: true },
    wa_app_secret_enc: { type: DataTypes.TEXT, allowNull: true },
    wa_webhook_verify_token: { type: DataTypes.STRING(128), allowNull: true },
    wa_api_version: { type: DataTypes.STRING(10), allowNull: true },
    email_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_sender_name: { type: DataTypes.STRING(120), allowNull: true },
    email_sender_address: { type: DataTypes.STRING(160), allowNull: true },
    email_reply_to: { type: DataTypes.STRING(160), allowNull: true },
    automations: { type: DataTypes.JSON, allowNull: true },
    festivals: { type: DataTypes.JSON, allowNull: true },
    credit_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 },
  },
  { sequelize, modelName: "MessagingSettings", tableName: "messaging_settings", underscored: true, timestamps: true }
);

export class MessageTemplate extends Model {
  declare id: number;
  declare owner_id: number;
  declare shop_id: number;
  declare name: string;
  declare category: string;
  declare message_type: "transactional" | "promotional";
  declare whatsapp_body: string | null;
  declare wa_template_name: string | null;
  declare wa_template_language: string | null;
  declare wa_template_params: string[] | null;
  declare email_subject: string | null;
  declare email_html: string | null;
  declare attachments: Array<{ name: string; url: string }> | null;
  declare is_active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

MessageTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    category: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "general" },
    message_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "transactional" },
    whatsapp_body: { type: DataTypes.TEXT, allowNull: true },
    wa_template_name: { type: DataTypes.STRING(120), allowNull: true },
    wa_template_language: { type: DataTypes.STRING(12), allowNull: true },
    wa_template_params: { type: DataTypes.JSON, allowNull: true },
    email_subject: { type: DataTypes.STRING(255), allowNull: true },
    email_html: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSON, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "MessageTemplate",
    tableName: "message_templates",
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ["owner_id", "shop_id"] }],
  }
);

export class MessageCampaign extends Model {
  declare id: number;
  declare owner_id: number;
  declare shop_id: number;
  declare created_by_type: string;
  declare created_by_id: number | null;
  declare kind: "single" | "group" | "automation";
  declare title: string | null;
  declare message_type: "transactional" | "promotional";
  declare channels: ChannelSelection;
  declare template_id: number | null;
  declare whatsapp_body: string | null;
  declare email_subject: string | null;
  declare email_html: string | null;
  declare attachments: Array<{ name: string; url: string }> | null;
  declare variables: Record<string, string> | null;
  declare audience: any;
  declare event_type: string | null;
  declare status: "scheduled" | "queued" | "sending" | "completed" | "cancelled" | "failed";
  declare scheduled_at: Date | null;
  declare recurrence: { every: "day" | "week" | "month"; interval: number; until?: string | null } | null;
  declare next_run_at: Date | null;
  declare run_count: number;
  declare last_run_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

MessageCampaign.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    created_by_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "owner" },
    created_by_id: { type: DataTypes.INTEGER, allowNull: true },
    kind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "single" },
    title: { type: DataTypes.STRING(160), allowNull: true },
    message_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "transactional" },
    channels: { type: DataTypes.STRING(10), allowNull: false },
    template_id: { type: DataTypes.INTEGER, allowNull: true },
    whatsapp_body: { type: DataTypes.TEXT, allowNull: true },
    email_subject: { type: DataTypes.STRING(255), allowNull: true },
    email_html: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSON, allowNull: true },
    variables: { type: DataTypes.JSON, allowNull: true },
    audience: { type: DataTypes.JSON, allowNull: true },
    event_type: { type: DataTypes.STRING(40), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "queued" },
    scheduled_at: { type: DataTypes.DATE, allowNull: true },
    recurrence: { type: DataTypes.JSON, allowNull: true },
    next_run_at: { type: DataTypes.DATE, allowNull: true },
    run_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_run_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "MessageCampaign",
    tableName: "message_campaigns",
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ["owner_id", "shop_id"] }, { fields: ["status", "next_run_at"] }],
  }
);

export class MessageDelivery extends Model {
  declare id: number;
  declare owner_id: number;
  declare shop_id: number;
  declare campaign_id: number | null;
  declare customer_id: number | null;
  declare channel: MessageChannel;
  declare recipient: string | null;
  declare recipient_name: string | null;
  declare message_type: "transactional" | "promotional";
  declare event_type: string | null;
  declare template_id: number | null;
  declare subject: string | null;
  declare body: string | null;
  declare html: string | null;
  declare attachments: Array<{ name: string; url: string }> | null;
  declare wa_template: { name: string; language: string; params: string[] } | null;
  declare status: DeliveryStatus;
  declare provider_message_id: string | null;
  declare failure_reason: string | null;
  declare attempts: number;
  declare max_attempts: number;
  declare next_attempt_at: Date | null;
  declare sent_at: Date | null;
  declare delivered_at: Date | null;
  declare read_at: Date | null;
  declare dedupe_key: string | null;
  declare reference_type: string | null;
  declare reference_id: number | null;
  declare log: Array<{ at: string; event: string; detail?: string }> | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

MessageDelivery.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    campaign_id: { type: DataTypes.INTEGER, allowNull: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: true },
    channel: { type: DataTypes.STRING(10), allowNull: false },
    recipient: { type: DataTypes.STRING(255), allowNull: true },
    recipient_name: { type: DataTypes.STRING(150), allowNull: true },
    message_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "transactional" },
    event_type: { type: DataTypes.STRING(40), allowNull: true },
    template_id: { type: DataTypes.INTEGER, allowNull: true },
    subject: { type: DataTypes.STRING(255), allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: true },
    html: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSON, allowNull: true },
    wa_template: { type: DataTypes.JSON, allowNull: true },
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "queued" },
    provider_message_id: { type: DataTypes.STRING(160), allowNull: true },
    failure_reason: { type: DataTypes.TEXT, allowNull: true },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    next_attempt_at: { type: DataTypes.DATE, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    read_at: { type: DataTypes.DATE, allowNull: true },
    dedupe_key: { type: DataTypes.STRING(200), allowNull: true },
    reference_type: { type: DataTypes.STRING(40), allowNull: true },
    reference_id: { type: DataTypes.BIGINT, allowNull: true },
    log: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "MessageDelivery",
    tableName: "message_deliveries",
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ["owner_id", "shop_id", "created_at"] },
      { fields: ["campaign_id"] },
      { fields: ["status", "next_attempt_at"] },
      { fields: ["provider_message_id"] },
      { unique: true, fields: ["shop_id", "dedupe_key"] },
    ],
  }
);

export class CustomerMessagePreference extends Model {
  declare id: number;
  declare owner_id: number;
  declare customer_id: number;
  declare allow_whatsapp: boolean;
  declare allow_email: boolean;
  declare promo_whatsapp: boolean;
  declare promo_email: boolean;
  declare whatsapp_number: string | null;
  declare date_of_birth: string | null;
  declare unsubscribe_token: string;
  declare last_inbound_at: Date | null;
  declare opted_out_at: Date | null;
}

CustomerMessagePreference.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    allow_whatsapp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    allow_email: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    promo_whatsapp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    promo_email: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    whatsapp_number: { type: DataTypes.STRING(20), allowNull: true },
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    unsubscribe_token: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    last_inbound_at: { type: DataTypes.DATE, allowNull: true },
    opted_out_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "CustomerMessagePreference",
    tableName: "customer_message_preferences",
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ["owner_id", "customer_id"] }],
  }
);
