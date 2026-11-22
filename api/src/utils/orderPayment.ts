/**
 * Once an order is billed, its payment status must follow the bill (the
 * real money record), not the label typed on the order before billing.
 */
type BillLike = { status?: string | null; total_amount?: unknown; paid_amount?: unknown } | null | undefined;

export function orderPaymentFromBill(sale: BillLike): "Paid" | "Partial" | "Pending" | null {
  if (!sale || sale.status === "cancelled") return null;
  const total = Number(sale.total_amount) || 0;
  const paid = Number(sale.paid_amount) || 0;
  if (paid >= total - 0.01) return "Paid";
  if (paid > 0.01) return "Partial";
  return "Pending";
}

/** Returns the order JSON with payment_status taken from its linked bill (when included). */
export function withBillPayment<T extends Record<string, any>>(json: T): T {
  const fromBill = orderPaymentFromBill(json?.convertedSale);
  return fromBill ? { ...json, payment_status: fromBill } : json;
}

/** Sequelize include for the bill linked to an order (money fields only). */
export const CONVERTED_SALE_ATTRS = ["id", "invoice_number", "status", "payment_status", "total_amount", "paid_amount", "due_amount"];
