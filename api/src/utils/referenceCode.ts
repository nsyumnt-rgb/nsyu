import { Transaction, QueryTypes } from "sequelize";
import sequelize from "../config/database";

/**
 * Business Timezone (India Standard Time by default)
 */
const TIMEZONE = process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";

/**
 * Formats a Date object in business timezone as YYMMDDHHmm
 * e.g. 2026-10-28 10:15 => '2610281015'
 */
export function formatTimeKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "00";

  const yy = getPart("year");
  const mm = getPart("month");
  const dd = getPart("day");
  const hh = getPart("hour");
  const min = getPart("minute");

  return `${yy}${mm}${dd}${hh}${min}`;
}

/**
 * Concurrency-safe atomic reference code generator for date-based transactions.
 * Produces format: <PREFIX><YYMMDDHHmm><0001>
 * e.g. INV26102810150001, ORD26102810150001, PAY26102810150001
 */
export async function nextDateReferenceCode(params: {
  ownerId: number;
  prefix: string; // e.g. 'INV', 'ORD', 'PAY', 'PUR', 'STM', 'TRF', 'CLG', 'SLG', 'ELG', 'ATT', 'PRL', 'EMI', 'SRT', 'PRT'
  date?: Date;
  transaction?: Transaction;
}): Promise<string> {
  const { ownerId, prefix, date = new Date(), transaction: t } = params;
  const timeKey = formatTimeKey(date);
  const scope = `${prefix.toUpperCase()}${timeKey}`;

  // Atomic upsert with Postgres ON CONFLICT DO UPDATE RETURNING last_number
  const query = `
    INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
    VALUES (:ownerId, :scope, 1, NOW(), NOW())
    ON CONFLICT (owner_id, scope)
    DO UPDATE SET last_number = reference_counters.last_number + 1, updated_at = NOW()
    RETURNING last_number;
  `;

  const results: any = await sequelize.query(query, {
    replacements: { ownerId, scope },
    type: QueryTypes.SELECT,
    transaction: t,
  });

  const lastNumber = results[0]?.last_number ?? 1;
  const seqStr = String(lastNumber).padStart(4, "0");
  return `${scope}${seqStr}`;
}

/**
 * Concurrency-safe atomic reference code generator for entity codes.
 * Produces format: <PREFIX>-<000001>
 * e.g. OWN-000001, SHP-000001, EMP-000001, CUS-000001, SUP-000001, PRD-000001, CAT-000001, SUB-000001
 */
export async function nextEntityReferenceCode(params: {
  ownerId: number;
  prefix: string; // e.g. 'OWN', 'SHP', 'EMP', 'CUS', 'SUP', 'PRD', 'CAT', 'SUB'
  transaction?: Transaction;
}): Promise<string> {
  const { ownerId, prefix, transaction: t } = params;
  const cleanPrefix = prefix.toUpperCase();
  const scope = `ENTITY_${cleanPrefix}`;

  const query = `
    INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
    VALUES (:ownerId, :scope, 1, NOW(), NOW())
    ON CONFLICT (owner_id, scope)
    DO UPDATE SET last_number = reference_counters.last_number + 1, updated_at = NOW()
    RETURNING last_number;
  `;

  const results: any = await sequelize.query(query, {
    replacements: { ownerId, scope },
    type: QueryTypes.SELECT,
    transaction: t,
  });

  const lastNumber = results[0]?.last_number ?? 1;
  const seqStr = String(lastNumber).padStart(6, "0");
  return `${cleanPrefix}-${seqStr}`;
}
