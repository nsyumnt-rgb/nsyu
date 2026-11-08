import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Sale,
  SaleItem,
  Payment,
  Customer,
  CustomerLedger,
  Notification,
  Shop,
} from "../models";
import { streamBillPdf } from "../utils/pdf";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/customer-portal/bills
 * Paginated bills (Sale) for this customer only.
 */
export async function listPortalBills(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const { status, from, to, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where: any = {
      customer_id: customerId,
      shop_id: shopId,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (from || to) {
      where.invoice_date = {};
      if (from) where.invoice_date[Op.gte] = new Date(String(from));
      if (to) where.invoice_date[Op.lte] = new Date(String(to));
    }

    const { count, rows } = await Sale.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["invoice_date", "DESC"], ["id", "DESC"]],
      include: [{ model: SaleItem, as: "items" }],
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list bills" });
  }
}

/**
 * GET /api/customer-portal/bills/:id
 */
export async function getPortalBill(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const billId = Number(req.params.id);

    const bill = await Sale.findOne({
      where: { id: billId, customer_id: customerId, shop_id: shopId },
      include: [
        { model: SaleItem, as: "items" },
        { model: Payment, as: "payments" },
        { model: Shop, as: "shop", attributes: ["id", "name", "phone", "address", "email"] },
      ],
    });

    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    return res.json({ success: true, data: bill });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load bill" });
  }
}

/**
 * GET /api/customer-portal/bills/:id/pdf
 */
export async function downloadPortalBillPdf(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const billId = Number(req.params.id);

    const bill = await Sale.findOne({
      where: { id: billId, customer_id: customerId, shop_id: shopId },
      include: [
        { model: SaleItem, as: "items" },
        { model: Customer, as: "customer" },
        { model: Shop, as: "shop" },
        { model: Payment, as: "payments" },
      ],
    });

    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    await streamBillPdf(res, bill);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to generate bill PDF" });
  }
}

/**
 * GET /api/customer-portal/ledger
 * Read-only statement of ledger entries with running balance.
 */
export async function listPortalLedger(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const { from, to, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const where: any = { customer_id: customerId };

    if (from || to) {
      where.entry_date = {};
      if (from) where.entry_date[Op.gte] = new Date(String(from));
      if (to) where.entry_date[Op.lte] = new Date(String(to));
    }

    const { count, rows } = await CustomerLedger.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["entry_date", "ASC"], ["id", "ASC"]],
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list ledger" });
  }
}

/**
 * GET /api/customer-portal/ledger/summary
 * Current outstanding, last payment and last bill.
 */
export async function getPortalLedgerSummary(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const [lastPayment, lastBill] = await Promise.all([
      Payment.findOne({
        where: { customer_id: customerId },
        order: [["payment_date", "DESC"], ["id", "DESC"]],
      }),
      Sale.findOne({
        where: { customer_id: customerId, shop_id: shopId },
        order: [["invoice_date", "DESC"], ["id", "DESC"]],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        currentOutstanding: round2(Number(customer.current_balance || 0)),
        lastPaymentDate: lastPayment?.payment_date || null,
        lastPaymentAmount: lastPayment ? round2(Number(lastPayment.amount)) : 0,
        lastBillDate: lastBill?.invoice_date || null,
        lastBillNumber: lastBill?.invoice_number || null,
        lastBillAmount: lastBill ? round2(Number(lastBill.total_amount)) : 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load ledger summary" });
  }
}

/**
 * GET /api/customer-portal/payments
 */
export async function listPortalPayments(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;

    const payments = await Payment.findAll({
      where: { customer_id: customerId, shop_id: shopId },
      order: [["payment_date", "DESC"], ["id", "DESC"]],
      include: [{ model: Sale, as: "sale", attributes: ["id", "invoice_number"] }],
    });

    return res.json({ success: true, data: payments });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list payments" });
  }
}

/**
 * GET /api/customer-portal/notifications
 */
export async function listPortalNotifications(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const { unread, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where: any = {
      recipient_type: "customer",
      recipient_id: customerId,
    };

    if (unread === "true") {
      where.is_read = false;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list notifications" });
  }
}

/**
 * GET /api/customer-portal/notifications/unread-count
 */
export async function getPortalUnreadCount(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const count = await Notification.count({
      where: {
        recipient_type: "customer",
        recipient_id: customerId,
        is_read: false,
      },
    });

    return res.json({ success: true, count });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to get unread count" });
  }
}

/**
 * PATCH /api/customer-portal/notifications/:id/read
 */
export async function markPortalNotificationRead(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const notifId = Number(req.params.id);

    const notif = await Notification.findOne({
      where: { id: notifId, recipient_type: "customer", recipient_id: customerId },
    });

    if (!notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    notif.is_read = true;
    await notif.save();

    return res.json({ success: true, message: "Marked as read", data: notif });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update notification" });
  }
}

/**
 * POST /api/customer-portal/notifications/read-all
 */
export async function markAllPortalNotificationsRead(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;

    await Notification.update(
      { is_read: true },
      { where: { recipient_type: "customer", recipient_id: customerId, is_read: false } }
    );

    return res.json({ success: true, message: "All notifications marked as read" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to mark all as read" });
  }
}

/**
 * GET /api/customer-portal/me
 */
export async function getPortalProfile(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;

    const [customer, shop] = await Promise.all([
      Customer.findByPk(customerId),
      Shop.findByPk(shopId),
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer profile not found" });
    }

    return res.json({
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        gstin: customer.gstin,
        currentBalance: round2(Number(customer.current_balance || 0)),
        shop: shop
          ? {
              id: shop.id,
              name: shop.name,
              code: shop.code,
              phone: shop.phone,
              email: shop.email,
              address: shop.address,
            }
          : null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load profile" });
  }
}

/**
 * PATCH /api/customer-portal/me
 * Allows customer to update email and address only.
 */
export async function updatePortalProfile(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const { email, address } = req.body;

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (email !== undefined) customer.email = email ? String(email).trim() : null;
    if (address !== undefined) customer.address = address ? String(address).trim() : null;

    await customer.save();

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update profile" });
  }
}
