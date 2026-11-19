import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize, Purchase, PurchaseItem, Supplier, SupplierLedger, Product, Shop } from "../models";
import { computePurchaseStatus } from "../models/Purchase";
import { recordStockMovement } from "../utils/inventory";
import { logAudit } from "../utils/audit";
import { notifyOwner } from "../utils/notifications";
import { streamPurchasePdf } from "../utils/pdf";
import {
  actorFromReq,
  nextPurchaseNumber,
  normalizePaymentMethod,
  postSupplierLedgerEntry,
  resolveShopScope,
  round2,
} from "../utils/supplierLedger";

/* ───────────────────────── helpers ───────────────────────── */

const purchaseIncludes = [
  { model: Supplier, as: "supplier" },
  { model: Shop, as: "shop", attributes: ["id", "name", "code", "address", "phone"] },
  { model: PurchaseItem, as: "items", include: [{ model: Product, as: "product", attributes: ["id", "name", "sku"] }] },
  { model: SupplierLedger, as: "ledgerEntries", required: false },
];

/** Shapes a purchase for the web/mobile clients: payments[] and returns[] derived from the ledger. */
function present(purchase: Purchase) {
  const json: any = purchase.toJSON();
  const entries: any[] = (json.ledgerEntries || []).sort((a: any, b: any) => Number(a.id) - Number(b.id));
  json.payments = entries
    .filter((e) => e.reference_type === "SupplierPayment")
    .map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      method: e.payment_method,
      transaction_id: e.transaction_id,
      payment_date: e.entry_date,
      notes: e.notes,
      created_at: e.created_at,
    }));
  json.returns = entries
    .filter((e) => e.reference_type === "PurchaseReturn")
    .map((e) => ({ id: e.id, amount: Number(e.amount), reason: e.notes, return_date: e.entry_date, description: e.description }));
  delete json.ledgerEntries;
  return json;
}

async function loadPurchase(ownerId: number, id: string | number, transaction?: any) {
  return Purchase.findOne({ where: { id, owner_id: ownerId }, include: purchaseIncludes, transaction });
}

function httpError(res: Response, err: any, fallback: string) {
  return res.status(err.status || 500).json({ success: false, message: err.message || fallback });
}

/* ───────────────────────── list / get ───────────────────────── */

/** GET /api/purchases?supplierId&status&from&to&shopId&allShops&limit */
export async function listPurchases(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const where: any = { owner_id: ownerId };
  const shopId = resolveShopScope(req);
  if (shopId) where.shop_id = shopId;
  if (req.query.supplierId) where.supplier_id = Number(req.query.supplierId);
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.from || req.query.to) {
    where.purchase_date = {};
    if (req.query.from) where.purchase_date[Op.gte] = new Date(String(req.query.from));
    if (req.query.to) {
      const to = new Date(String(req.query.to));
      to.setHours(23, 59, 59, 999);
      where.purchase_date[Op.lte] = to;
    }
  }

  const purchases = await Purchase.findAll({
    where,
    include: [
      { model: Supplier, as: "supplier", attributes: ["id", "name", "phone", "gstin"] },
      { model: Shop, as: "shop", attributes: ["id", "name", "code"] },
      { model: PurchaseItem, as: "items" },
    ],
    order: [["purchase_date", "DESC"], ["id", "DESC"]],
    limit: Math.min(Number(req.query.limit) || 100, 500),
  });
  return res.json({ success: true, data: purchases });
}

/** GET /api/purchases/:id */
export async function getPurchase(req: Request, res: Response) {
  const purchase = await loadPurchase(req.auth!.ownerId, req.params.id);
  if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });
  return res.json({ success: true, data: present(purchase) });
}

/* ───────────────────────── create ───────────────────────── */

/**
 * POST /api/purchases
 * { supplierId, items: [{ productId, quantity, rate, taxPercent?, discountAmount? }],
 *   initialPaid?, paymentMethod?, transactionId?, notes?, purchaseDate?, shopId?, clientRequestId? }
 *
 * ONE DB transaction: bill + line items + stock-in for every line +
 * payable posted to supplier ledger (+ initial payment). If anything
 * fails, nothing is written.
 *
 * `rate` is the final unit cost the shop pays. Tax is added only when
 * `taxPercent` is sent explicitly, so the server total always matches
 * the amount the user entered.
 */
export async function createPurchase(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { actorType, actorId } = actorFromReq(req);
  const { supplierId, items, initialPaid, paidAmount, paymentMethod, transactionId, notes, purchaseDate } = req.body;

  if (!supplierId) return res.status(400).json({ success: false, message: "supplierId is required" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Add at least one product" });
  }

  let shopId: number | undefined = req.auth!.shopId ?? undefined;
  if (req.auth!.isOwner && req.body.shopId) shopId = Number(req.body.shopId);
  if (!shopId) return res.status(400).json({ success: false, message: "Select a shop before recording a purchase" });

  const clientRequestId = String(req.headers["x-idempotency-key"] || req.body.clientRequestId || "").trim() || null;
  if (clientRequestId) {
    const existing = await Purchase.findOne({ where: { owner_id: ownerId, client_request_id: clientRequestId }, include: purchaseIncludes });
    if (existing) return res.json({ success: true, idempotent: true, data: present(existing) });
  }

  try {
    const purchaseId = await sequelize.transaction(async (t) => {
      const shop = await Shop.findOne({ where: { id: shopId, owner_id: ownerId }, transaction: t });
      if (!shop) throw Object.assign(new Error("Shop not found"), { status: 404 });
      const supplier = await Supplier.findOne({ where: { id: supplierId, owner_id: ownerId }, transaction: t });
      if (!supplier) throw Object.assign(new Error("Supplier not found"), { status: 404 });
      if (supplier.status !== "active") throw Object.assign(new Error("Supplier is inactive"), { status: 400 });

      // 1. Price the lines
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      const lines: any[] = [];
      for (const raw of items) {
        const productId = Number(raw.productId ?? raw.product_id);
        const qty = Math.floor(Number(raw.quantity ?? raw.qty));
        const rate = Number(raw.rate);
        if (!productId || !(qty > 0)) throw Object.assign(new Error("Each line needs a product and a quantity above zero"), { status: 400 });
        if (!(rate >= 0) || Number.isNaN(rate)) throw Object.assign(new Error("Each line needs a valid rate"), { status: 400 });
        const product = await Product.findOne({ where: { id: productId, owner_id: ownerId }, transaction: t });
        if (!product) throw Object.assign(new Error(`Product #${productId} not found`), { status: 404 });

        const gross = round2(qty * rate);
        const discount = Math.min(gross, round2(Number(raw.discountAmount ?? raw.discount_amount ?? 0) || 0));
        const taxPercent = Math.max(0, Number(raw.taxPercent ?? raw.tax_percent ?? 0) || 0);
        const taxable = round2(gross - discount);
        const tax = round2((taxable * taxPercent) / 100);
        subtotal = round2(subtotal + gross);
        discountTotal = round2(discountTotal + discount);
        taxTotal = round2(taxTotal + tax);
        lines.push({ product, qty, rate, discount, taxPercent, tax, total: round2(taxable + tax) });
      }
      const total = round2(subtotal - discountTotal + taxTotal);
      const paidNow = round2(Number(initialPaid ?? paidAmount) || 0);
      if (paidNow < 0) throw Object.assign(new Error("Paid amount cannot be negative"), { status: 400 });
      if (paidNow > total + 0.005) throw Object.assign(new Error(`Paid amount cannot exceed the bill total (₹${total.toFixed(2)})`), { status: 400 });

      // 2. Bill + items
      const purchaseNumber = await nextPurchaseNumber(ownerId, shopId!, t);
      const purchase = await Purchase.create(
        {
          owner_id: ownerId,
          shop_id: shopId!,
          supplier_id: supplier.id,
          purchase_number: purchaseNumber,
          purchase_date: purchaseDate ? new Date(purchaseDate) : new Date(),
          subtotal,
          discount_amount: discountTotal,
          tax_amount: taxTotal,
          total_amount: total,
          paid_amount: paidNow,
          due_amount: round2(total - paidNow),
          returned_amount: 0,
          payment_method: paidNow > 0 ? normalizePaymentMethod(paymentMethod) : null,
          status: computePurchaseStatus({ total_amount: total, paid_amount: paidNow, due_amount: total - paidNow, returned_amount: 0 }),
          notes: String(notes || "").trim().slice(0, 255) || null,
          client_request_id: clientRequestId,
          actor_type: actorType,
          actor_id: actorId,
        },
        { transaction: t }
      );

      for (const l of lines) {
        await PurchaseItem.create(
          {
            purchase_id: purchase.id,
            product_id: l.product.id,
            product_name: String(l.product.name).slice(0, 150),
            sku: String(l.product.sku ?? "").slice(0, 60),
            quantity: l.qty,
            rate: l.rate,
            discount_amount: l.discount,
            tax_percent: l.taxPercent,
            tax_amount: l.tax,
            total_amount: l.total,
          },
          { transaction: t }
        );
        // 3. Stock-in
        await recordStockMovement({
          ownerId,
          shopId: shopId!,
          productId: l.product.id,
          type: "purchase",
          quantity: l.qty,
          actorType,
          actorId,
          referenceType: "Purchase",
          referenceId: purchase.id,
          notes: `Purchase ${purchaseNumber}`,
          externalTransaction: t,
        });
      }

      // 4. Payable + initial payment in the supplier ledger
      if (total > 0) {
        await postSupplierLedgerEntry({
          ownerId,
          shopId: shopId!,
          supplierId: supplier.id,
          purchaseId: purchase.id,
          effect: "increase",
          amount: total,
          referenceType: "Purchase",
          referenceId: purchase.id,
          referenceCode: purchaseNumber,
          description: `Purchase bill ${purchaseNumber}`,
          actorType,
          actorId,
          transaction: t,
        });
      }
      if (paidNow > 0) {
        await postSupplierLedgerEntry({
          ownerId,
          shopId: shopId!,
          supplierId: supplier.id,
          purchaseId: purchase.id,
          effect: "decrease",
          amount: paidNow,
          referenceType: "SupplierPayment",
          referenceId: purchase.id,
          referenceCode: purchaseNumber,
          description: `Payment for ${purchaseNumber}`,
          paymentMethod: normalizePaymentMethod(paymentMethod),
          transactionId: String(transactionId || "").trim() || null,
          actorType,
          actorId,
          transaction: t,
        });
      }
      return purchase.id;
    });

    const created = (await loadPurchase(ownerId, purchaseId))!;
    await logAudit({ req, module: "purchase", action: "create", entityType: "Purchase", entityId: purchaseId });
    notifyOwner(ownerId, {
      shopId,
      type: "general",
      title: "Purchase recorded",
      message: `${created.purchase_number} from ${(created as any).supplier?.name || "supplier"} · ₹${Number(created.total_amount).toFixed(2)}`,
      referenceType: "Purchase",
      referenceId: purchaseId,
    });
    return res.status(201).json({ success: true, data: present(created) });
  } catch (err: any) {
    if (err?.name === "SequelizeUniqueConstraintError" && clientRequestId) {
      const existing = await Purchase.findOne({ where: { owner_id: ownerId, client_request_id: clientRequestId }, include: purchaseIncludes });
      if (existing) return res.json({ success: true, idempotent: true, data: present(existing) });
    }
    return httpError(res, err, "Could not create purchase");
  }
}

/* ───────────────────────── payment ───────────────────────── */

/** POST /api/purchases/:id/payment { amount, method, transactionId?, paymentDate?, notes?, idempotencyKey? } */
export async function recordPurchasePayment(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { actorType, actorId } = actorFromReq(req);
  const amount = round2(Number(req.body.amount) || 0);
  if (!(amount > 0)) return res.status(400).json({ success: false, message: "Enter a payment amount above zero" });
  const idempotencyKey = String(req.headers["x-idempotency-key"] || req.body.idempotencyKey || "").trim() || null;

  if (idempotencyKey) {
    const dup = await SupplierLedger.findOne({ where: { owner_id: ownerId, idempotency_key: idempotencyKey } });
    if (dup) return res.json({ success: true, idempotent: true, data: dup });
  }

  try {
    const entry = await sequelize.transaction(async (t) => {
      const purchase = await Purchase.findOne({ where: { id: req.params.id, owner_id: ownerId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!purchase) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (!req.auth!.isOwner && purchase.shop_id !== req.auth!.shopId) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (purchase.status === "cancelled") throw Object.assign(new Error("This purchase is cancelled"), { status: 400 });
      const due = round2(Number(purchase.due_amount));
      if (due <= 0) throw Object.assign(new Error("This purchase is already fully paid"), { status: 400 });
      if (amount > due + 0.005) throw Object.assign(new Error(`Amount exceeds the due balance (₹${due.toFixed(2)})`), { status: 400 });

      const method = normalizePaymentMethod(req.body.method ?? req.body.paymentMethod);
      const e = await postSupplierLedgerEntry({
        ownerId,
        shopId: purchase.shop_id,
        supplierId: purchase.supplier_id,
        purchaseId: purchase.id,
        effect: "decrease",
        amount,
        referenceType: "SupplierPayment",
        referenceId: purchase.id,
        referenceCode: purchase.purchase_number,
        description: `Payment for ${purchase.purchase_number}`,
        paymentMethod: method,
        transactionId: String(req.body.transactionId || "").trim() || null,
        idempotencyKey,
        notes: String(req.body.notes || "").trim() || null,
        entryDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
        actorType,
        actorId,
        transaction: t,
      });

      purchase.paid_amount = round2(Number(purchase.paid_amount) + amount);
      purchase.due_amount = round2(due - amount);
      purchase.payment_method = method;
      purchase.status = computePurchaseStatus(purchase as any);
      await purchase.save({ transaction: t });
      return e;
    });

    await logAudit({ req, module: "purchase", action: "payment", entityType: "Purchase", entityId: Number(req.params.id) });
    return res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    return httpError(res, err, "Could not record payment");
  }
}

/* ───────────────────────── cancel ───────────────────────── */

/**
 * POST /api/purchases/:id/cancel { reason? }
 * Allowed only before any payment or return (pay-outs must be settled
 * explicitly). Reverses stock-in and posts an offsetting ledger credit.
 * The original bill is kept, marked cancelled.
 */
export async function cancelPurchase(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { actorType, actorId } = actorFromReq(req);
  const reason = String(req.body.reason || "").trim().slice(0, 255) || null;

  try {
    await sequelize.transaction(async (t) => {
      const purchase = await Purchase.findOne({
        where: { id: req.params.id, owner_id: ownerId },
        include: [{ model: PurchaseItem, as: "items" }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!purchase) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (!req.auth!.isOwner && purchase.shop_id !== req.auth!.shopId) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (purchase.status === "cancelled") throw Object.assign(new Error("Purchase is already cancelled"), { status: 400 });
      if (Number(purchase.paid_amount) > 0) {
        throw Object.assign(new Error("Payments have been made against this bill. Record a purchase return instead of cancelling."), { status: 400 });
      }
      if (Number(purchase.returned_amount) > 0) {
        throw Object.assign(new Error("Items were already returned from this bill; it can't be cancelled."), { status: 400 });
      }

      for (const item of (purchase as any).items as PurchaseItem[]) {
        await recordStockMovement({
          ownerId,
          shopId: purchase.shop_id,
          productId: item.product_id,
          type: "purchase_return",
          quantity: item.quantity,
          actorType,
          actorId,
          referenceType: "PurchaseCancellation",
          referenceId: purchase.id,
          notes: `Cancelled ${purchase.purchase_number}`,
          externalTransaction: t,
        });
      }

      if (Number(purchase.total_amount) > 0) {
        await postSupplierLedgerEntry({
          ownerId,
          shopId: purchase.shop_id,
          supplierId: purchase.supplier_id,
          purchaseId: purchase.id,
          effect: "decrease",
          amount: Number(purchase.total_amount),
          referenceType: "PurchaseCancellation",
          referenceId: purchase.id,
          referenceCode: purchase.purchase_number,
          description: `Cancelled ${purchase.purchase_number}`,
          notes: reason,
          actorType,
          actorId,
          transaction: t,
        });
        await SupplierLedger.update(
          { status: "reversed" },
          { where: { purchase_id: purchase.id, reference_type: "Purchase" }, transaction: t }
        );
      }

      purchase.status = "cancelled";
      purchase.due_amount = 0;
      purchase.cancel_reason = reason;
      purchase.cancelled_at = new Date();
      await purchase.save({ transaction: t });
    });

    const updated = (await loadPurchase(ownerId, req.params.id))!;
    await logAudit({ req, module: "purchase", action: "cancel", entityType: "Purchase", entityId: updated.id });
    return res.json({ success: true, data: present(updated) });
  } catch (err: any) {
    return httpError(res, err, "Could not cancel purchase");
  }
}

/* ───────────────────────── return ───────────────────────── */

/**
 * POST /api/purchases/:id/return { items: [{ purchaseItemId, quantity }], reason? }
 * Sends goods back to the supplier: stock out, payable reduced by the
 * returned value (line total pro-rata). If the return exceeds what is
 * still due, the excess becomes a supplier advance (negative balance).
 */
export async function returnPurchase(req: Request, res: Response) {
  const ownerId = req.auth!.ownerId;
  const { actorType, actorId } = actorFromReq(req);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ success: false, message: "Select at least one item to return" });
  const reason = String(req.body.reason || "").trim().slice(0, 255) || null;

  try {
    const result = await sequelize.transaction(async (t) => {
      const purchase = await Purchase.findOne({
        where: { id: req.params.id, owner_id: ownerId },
        include: [{ model: PurchaseItem, as: "items" }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!purchase) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (!req.auth!.isOwner && purchase.shop_id !== req.auth!.shopId) throw Object.assign(new Error("Purchase not found"), { status: 404 });
      if (purchase.status === "cancelled") throw Object.assign(new Error("This purchase is cancelled"), { status: 400 });

      const lines = (purchase as any).items as PurchaseItem[];
      let returnValue = 0;
      const summary: string[] = [];
      for (const r of items) {
        const line = lines.find((l) => Number(l.id) === Number(r.purchaseItemId ?? r.purchase_item_id));
        const qty = Math.floor(Number(r.quantity));
        if (!line) throw Object.assign(new Error("Return line does not belong to this purchase"), { status: 400 });
        if (!(qty > 0)) continue;
        const remaining = line.quantity - line.returned_quantity;
        if (qty > remaining) throw Object.assign(new Error(`Only ${remaining} of "${line.product_name}" can still be returned`), { status: 400 });

        await recordStockMovement({
          ownerId,
          shopId: purchase.shop_id,
          productId: line.product_id,
          type: "purchase_return",
          quantity: qty,
          actorType,
          actorId,
          referenceType: "PurchaseReturn",
          referenceId: purchase.id,
          notes: `Return against ${purchase.purchase_number}`,
          externalTransaction: t,
        });
        line.returned_quantity += qty;
        await line.save({ transaction: t });
        returnValue = round2(returnValue + (Number(line.total_amount) / line.quantity) * qty);
        summary.push(`${line.product_name} × ${qty}`);
      }
      if (!(returnValue > 0)) throw Object.assign(new Error("Nothing to return"), { status: 400 });

      const entry = await postSupplierLedgerEntry({
        ownerId,
        shopId: purchase.shop_id,
        supplierId: purchase.supplier_id,
        purchaseId: purchase.id,
        effect: "decrease",
        amount: returnValue,
        referenceType: "PurchaseReturn",
        referenceId: purchase.id,
        referenceCode: purchase.purchase_number,
        description: `Return: ${summary.join(", ")}`.slice(0, 250),
        notes: reason,
        actorType,
        actorId,
        transaction: t,
      });

      purchase.returned_amount = round2(Number(purchase.returned_amount) + returnValue);
      purchase.due_amount = round2(Math.max(0, Number(purchase.due_amount) - returnValue));
      purchase.status = computePurchaseStatus(purchase as any);
      await purchase.save({ transaction: t });
      return { entry, returnValue };
    });

    await logAudit({ req, module: "purchase", action: "return", entityType: "Purchase", entityId: Number(req.params.id) });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    return httpError(res, err, "Could not record purchase return");
  }
}

/* ───────────────────────── pdf ───────────────────────── */

/** GET /api/purchases/:id/pdf */
export async function downloadPurchasePdf(req: Request, res: Response) {
  const purchase = await loadPurchase(req.auth!.ownerId, req.params.id);
  if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });
  return streamPurchasePdf(res, present(purchase));
}
