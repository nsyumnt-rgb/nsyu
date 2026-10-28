import { Request, Response } from "express";
import { Payment, Sale, Customer, Shop, EMIInstallment } from "../models";
import { streamReceiptPdf } from "../utils/pdf";
import { logAudit } from "../utils/audit";
import { recordLedgerEntry } from "../utils/ledger";
import { sequelize } from "../models";

export async function listPayments(req: Request, res: Response) {
  const { customerId, saleId, type, allShops } = req.query;
  let targetShopId: number | undefined;

  if (req.auth!.isOwner) {
    if (allShops === "true") {
      targetShopId = undefined;
    } else {
      targetShopId = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId || undefined;
    }
  } else {
    targetShopId = req.auth!.shopId || undefined;
  }

  const where: any = { owner_id: req.auth!.ownerId };
  if (targetShopId) where.shop_id = targetShopId;
  if (customerId) where.customer_id = customerId;
  if (saleId) where.sale_id = saleId;
  if (type) where.type = type;

  const payments = await Payment.findAll({
    where,
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "phone"] },
      { model: Sale, as: "sale", attributes: ["id", "invoice_number"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: EMIInstallment, as: "installment", attributes: ["id", "installment_number"] },
    ],
    order: [["payment_date", "DESC"]],
    limit: Number(req.query.limit) || 100,
  });

  return res.json({ success: true, data: payments });
}

export async function getPayment(req: Request, res: Response) {
  const param = String(req.params.paymentId).trim();
  const digitsMatch = param.match(/\d+$/);
  const numericId = digitsMatch ? Number(digitsMatch[0]) : null;

  const where: any = { owner_id: req.auth!.ownerId };
  if (numericId !== null && !isNaN(numericId)) {
    where.id = numericId;
  } else {
    where.transaction_id = param;
  }

  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }

  const payment = await Payment.findOne({
    where,
    include: [
      { model: Customer, as: "customer" },
      { model: Sale, as: "sale" },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: EMIInstallment, as: "installment" },
    ],
  });
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
  return res.json({ success: true, data: payment });
}

/**
 * Voids a payment: never deletes it. Flips status to "cancelled" and
 * posts a reversing debit on the customer ledger, then re-syncs the
 * owning Sale's / EMI installment's paid/due amounts.
 */
export async function cancelPayment(req: Request, res: Response) {
  const { reason } = req.body;
  const ownerId = req.auth!.ownerId;
  const shopId = req.auth!.shopId!;
  const actorType = req.auth!.isOwner ? "owner" : "employee";
  const actorId = req.auth!.isOwner ? req.auth!.ownerId : req.auth!.employeeId!;

  try {
    await sequelize.transaction(async (t) => {
      const where: any = { id: req.params.paymentId, owner_id: ownerId };
      if (!req.auth!.isOwner) {
        where.shop_id = shopId;
      }
      const payment = await Payment.findOne({
        where,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
      if (payment.status === "cancelled") throw Object.assign(new Error("Payment already cancelled"), { status: 400 });

      await recordLedgerEntry({
        ownerId,
        shopId: payment.shop_id,
        customerId: payment.customer_id,
        entryType: "debit",
        amount: Number(payment.amount),
        referenceType: "PaymentCancellation",
        referenceId: payment.id,
        description: `Reversal of payment #${payment.id}${reason ? `: ${reason}` : ""}`,
        actorType: actorType as "owner" | "employee",
        actorId: actorId as number,
        externalTransaction: t,
      });

      payment.status = "cancelled";
      payment.notes = [payment.notes, reason ? `Cancelled: ${reason}` : "Cancelled"].filter(Boolean).join(" | ");
      await payment.save({ transaction: t });

      if (payment.sale_id) {
        const sale = await Sale.findOne({ where: { id: payment.sale_id }, transaction: t, lock: t.LOCK.UPDATE });
        if (sale) {
          sale.paid_amount = Math.max(0, Number(sale.paid_amount) - Number(payment.amount));
          sale.due_amount = Number(sale.total_amount) - sale.paid_amount;
          sale.status = sale.due_amount <= 0 ? "paid" : sale.paid_amount > 0 ? "partially_paid" : "unpaid";
          await sale.save({ transaction: t });
        }
      }

      if (payment.emi_installment_id) {
        const installment = await EMIInstallment.findOne({
          where: { id: payment.emi_installment_id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (installment) {
          installment.paid_amount = Math.max(0, Number(installment.paid_amount) - Number(payment.amount));
          installment.remaining_amount = Number(installment.expected_amount) + Number(installment.late_fee) - installment.paid_amount;
          installment.status = installment.paid_amount > 0 ? "Partially Paid" : "Due";
          await installment.save({ transaction: t });
        }
      }

      await logAudit({ req, module: "payments", action: "cancel", entityType: "Payment", entityId: payment.id, details: { reason } });
    });

    const payment = await Payment.findByPk(req.params.paymentId, {
      include: [
        { model: Customer, as: "customer" },
        { model: Sale, as: "sale" },
        { model: Shop, as: "shop" },
      ],
    });
    return res.json({ success: true, data: payment });
  } catch (err: any) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function downloadReceiptPdf(req: Request, res: Response) {
  const where: any = { id: req.params.paymentId, owner_id: req.auth!.ownerId };
  if (!req.auth!.isOwner) {
    where.shop_id = req.auth!.shopId;
  }

  const payment = await Payment.findOne({
    where,
    include: [
      { model: Customer, as: "customer" },
      { model: Sale, as: "sale" },
      { model: EMIInstallment, as: "installment" },
      { model: Shop, as: "shop" },
    ],
  });
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  streamReceiptPdf(res, payment.toJSON());
}
