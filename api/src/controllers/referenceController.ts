import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Sale,
  Payment,
  Product,
  Customer,
  InventoryTransaction,
} from "../models";

/**
 * Universal Reference Resolver:
 * Resolves any record identifier (invoice_number,
 * SKU, transaction_id, customer, payment) to its canonical
 * route, record type, and database ID.
 */
export async function resolveReference(req: Request, res: Response) {
  const ref = String(req.query.ref || "").trim();
  if (!ref) {
    return res.status(400).json({ success: false, message: "ref query parameter is required" });
  }

  const ownerId = req.auth!.ownerId;
  const upper = ref.toUpperCase();

  // 1. Sales Invoice: starts with "INV" or matches invoice_number
  if (upper.startsWith("INV") || upper.includes("INV-")) {
    const sale = await Sale.findOne({
      where: { owner_id: ownerId, invoice_number: { [Op.iLike]: ref } },
      attributes: ["id", "invoice_number", "total_amount", "customer_id", "status"],
    });
    if (sale) {
      return res.json({
        success: true,
        data: {
          type: "sale",
          id: sale.id,
          reference: sale.invoice_number,
          route: `/app/sales/${sale.id}`,
          title: `Invoice #${sale.invoice_number}`,
          record: sale,
        },
      });
    }
  }

  // 2. Payment: starts with "PAY" or numeric ID match
  if (upper.startsWith("PAY") || upper.includes("PAY-")) {
    const digits = ref.match(/\d+$/);
    const numId = digits ? Number(digits[0]) : null;
    const paymentWhere: any = { owner_id: ownerId };
    if (numId) {
      paymentWhere[Op.or] = [{ id: numId }, { transaction_id: { [Op.iLike]: ref } }];
    } else {
      paymentWhere.transaction_id = { [Op.iLike]: ref };
    }
    const payment = await Payment.findOne({ where: paymentWhere });
    if (payment) {
      return res.json({
        success: true,
        data: {
          type: "payment",
          id: payment.id,
          reference: `PAY-${payment.id}`,
          route: `/app/payments/${payment.id}`,
          title: `Payment Receipt #${payment.id}`,
          record: payment,
        },
      });
    }
  }

  // 3. Product SKU lookup
  const product = await Product.findOne({
    where: { owner_id: ownerId, sku: { [Op.iLike]: ref } },
    attributes: ["id", "name", "sku", "selling_price"],
  });
  if (product) {
    return res.json({
      success: true,
      data: {
        type: "product",
        id: product.id,
        reference: product.sku,
        route: `/app/products/${product.id}`,
        title: product.name,
        record: product,
      },
    });
  }

  // 4. Customer lookup (by phone, name, or CUST-ID)
  const custDigits = ref.match(/CUST[-_]?(\d+)/i);
  const custId = custDigits ? Number(custDigits[1]) : null;
  const customer = await Customer.findOne({
    where: {
      owner_id: ownerId,
      [Op.or]: [
        ...(custId ? [{ id: custId }] : []),
        { phone: ref },
        { name: { [Op.iLike]: ref } },
      ],
    },
    attributes: ["id", "name", "phone"],
  });
  if (customer) {
    return res.json({
      success: true,
      data: {
        type: "customer",
        id: customer.id,
        reference: customer.name,
        route: `/app/customers/${customer.id}`,
        title: customer.name,
        record: customer,
      },
    });
  }

  // 5. Fallback: check Sale by partial match
  const fallbackSale = await Sale.findOne({
    where: { owner_id: ownerId, invoice_number: { [Op.iLike]: `%${ref}%` } },
  });
  if (fallbackSale) {
    return res.json({
      success: true,
      data: {
        type: "sale",
        id: fallbackSale.id,
        reference: fallbackSale.invoice_number,
        route: `/app/sales/${fallbackSale.id}`,
        title: `Invoice #${fallbackSale.invoice_number}`,
        record: fallbackSale,
      },
    });
  }

  return res.status(404).json({ success: false, message: `No record matching reference "${ref}" was found.` });
}
