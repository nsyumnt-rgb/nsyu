import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Sale,
  Purchase,
  Payment,
  StockTransfer,
  Product,
  Customer,
  Supplier,
  Employee,
  EMIPlan,
  Payroll,
  InventoryTransaction,
} from "../models";

/**
 * Universal Reference Resolver:
 * Resolves any record identifier (invoice_number, purchase_number, transfer_no,
 * SKU, transaction_id, customer, supplier, employee, payment) to its canonical
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

  // 2. Purchase Bill: starts with "PUR" or matches purchase_number
  if (upper.startsWith("PUR") || upper.includes("PUR-")) {
    const purchase = await Purchase.findOne({
      where: { owner_id: ownerId, purchase_number: { [Op.iLike]: ref } },
      attributes: ["id", "purchase_number", "total_amount", "supplier_id", "status"],
    });
    if (purchase) {
      return res.json({
        success: true,
        data: {
          type: "purchase",
          id: purchase.id,
          reference: purchase.purchase_number,
          route: `/app/purchase/${purchase.id}`,
          title: `Purchase Bill #${purchase.purchase_number}`,
          record: purchase,
        },
      });
    }
  }

  // 3. Stock Transfer: starts with "TRF" or matches transfer_no
  if (upper.startsWith("TRF") || upper.includes("TRF-")) {
    const transfer = await StockTransfer.findOne({
      where: { owner_id: ownerId, transfer_no: { [Op.iLike]: ref } },
    });
    if (transfer) {
      return res.json({
        success: true,
        data: {
          type: "transfer",
          id: transfer.id,
          reference: transfer.transfer_no,
          route: `/app/inventory/transfers/${transfer.id}`,
          title: `Transfer #${transfer.transfer_no}`,
          record: transfer,
        },
      });
    }
  }

  // 4. Payment: starts with "PAY" or numeric ID match
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

  // 5. Product SKU lookup
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

  // 6. Customer lookup (by phone, name, or CUST-ID)
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

  // 7. Supplier lookup
  const suppDigits = ref.match(/SUPP?[-_]?(\d+)/i);
  const suppId = suppDigits ? Number(suppDigits[1]) : null;
  const supplier = await Supplier.findOne({
    where: {
      owner_id: ownerId,
      [Op.or]: [
        ...(suppId ? [{ id: suppId }] : []),
        { name: { [Op.iLike]: ref } },
        { phone: ref },
      ],
    },
    attributes: ["id", "name", "phone"],
  });
  if (supplier) {
    return res.json({
      success: true,
      data: {
        type: "supplier",
        id: supplier.id,
        reference: supplier.name,
        route: `/app/suppliers/${supplier.id}`,
        title: supplier.name,
        record: supplier,
      },
    });
  }

  // 8. Fallback: check Sale or Purchase by partial match
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
