import { Request, Response } from "express";
import { sequelize, Product, Customer, Sale, SaleItem, Payment, Shop, Category } from "../models";
import { logAudit } from "../utils/audit";

export async function exportBackup(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const ownerId = auth.ownerId;
    const shopId = auth.shopId;

    const [shops, categories, products, customers, sales, payments] = await Promise.all([
      Shop.findAll({ where: { owner_id: ownerId } }),
      Category.findAll({ where: { owner_id: ownerId } }),
      Product.findAll({ where: { owner_id: ownerId } }),
      Customer.findAll({ where: { owner_id: ownerId } }),
      Sale.findAll({
        where: shopId && !auth.isOwner ? { owner_id: ownerId, shop_id: shopId } : { owner_id: ownerId },
        include: [{ model: SaleItem, as: "items" }],
        limit: 500,
        order: [["id", "DESC"]],
      }),
      Payment.findAll({
        where: shopId && !auth.isOwner ? { owner_id: ownerId, shop_id: shopId } : { owner_id: ownerId },
        limit: 500,
        order: [["id", "DESC"]],
      }),
    ]);

    const backupData = {
      app: "NSYU Business",
      version: "1.0",
      exportDate: new Date().toISOString(),
      ownerId,
      shopId: shopId ?? 1,
      stats: {
        shopsCount: shops.length,
        categoriesCount: categories.length,
        productsCount: products.length,
        customersCount: customers.length,
        salesCount: sales.length,
        paymentsCount: payments.length,
      },
      data: {
        shops,
        categories,
        products,
        customers,
        sales,
        payments,
      },
    };

    await logAudit({
      req,
      module: "settings",
      action: "backup_export",
      entityType: "Backup",
      details: { stats: backupData.stats },
    });

    return res.json({ success: true, data: backupData });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function validateBackup(req: Request, res: Response) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ success: false, message: "Invalid backup format: payload must be a JSON object" });
    }

    if (!payload.data || typeof payload.data !== "object") {
      return res.status(400).json({ success: false, message: "Invalid backup format: missing 'data' container" });
    }

    const { products, customers, sales, categories } = payload.data;
    const stats = {
      productsCount: Array.isArray(products) ? products.length : 0,
      customersCount: Array.isArray(customers) ? customers.length : 0,
      salesCount: Array.isArray(sales) ? sales.length : 0,
      categoriesCount: Array.isArray(categories) ? categories.length : 0,
    };

    return res.json({
      success: true,
      valid: true,
      version: payload.version || "1.0",
      exportDate: payload.exportDate || "Unknown",
      stats,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function restoreBackup(req: Request, res: Response) {
  const t = await sequelize.transaction();
  try {
    const auth = req.auth!;
    if (!auth.isOwner) {
      await t.rollback();
      return res.status(403).json({ success: false, message: "Only the business Owner can restore backups" });
    }

    const payload = req.body;
    if (!payload?.data) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid backup file: missing data block" });
    }

    const ownerId = auth.ownerId;
    let productsRestored = 0;
    let customersRestored = 0;

    // Restore/upsert customers
    if (Array.isArray(payload.data.customers)) {
      for (const c of payload.data.customers) {
        if (!c.name || !c.phone) continue;
        const [customer, created] = await Customer.findOrCreate({
          where: { owner_id: ownerId, phone: String(c.phone).trim() },
          defaults: {
            owner_id: ownerId,
            name: String(c.name).trim(),
            phone: String(c.phone).trim(),
            address: c.address ?? "",
            gstin: c.gstin ?? null,
            opening_balance: c.opening_balance ?? 0,
            current_balance: c.current_balance ?? 0,
            status: c.status ?? "active",
          },
          transaction: t,
        });
        if (!created) {
          customer.name = String(c.name).trim();
          if (c.address) customer.address = c.address;
          await customer.save({ transaction: t });
        }
        customersRestored++;
      }
    }

    // Restore/upsert products
    if (Array.isArray(payload.data.products)) {
      for (const p of payload.data.products) {
        const prodSku = (p.sku || p.code || "").toString().trim().toUpperCase();
        if (!prodSku || !p.name) continue;
        const [prod, created] = await Product.findOrCreate({
          where: { owner_id: ownerId, sku: prodSku },
          defaults: {
            owner_id: ownerId,
            sku: prodSku,
            name: String(p.name).trim(),
            category_id: p.category_id ?? null,
            subcategory_id: p.subcategory_id ?? null,
            supplier_id: p.supplier_id ?? null,
            purchase_price: p.purchase_price ?? 0,
            selling_price: p.selling_price ?? 0,
            mrp: p.mrp ?? p.selling_price ?? 0,
            status: p.status ?? "active",
          },
          transaction: t,
        });
        if (!created) {
          prod.name = String(p.name).trim();
          if (p.purchase_price) prod.purchase_price = p.purchase_price;
          if (p.selling_price) prod.selling_price = p.selling_price;
          await prod.save({ transaction: t });
        }
        productsRestored++;
      }
    }

    await t.commit();

    await logAudit({
      req,
      module: "settings",
      action: "backup_restore",
      entityType: "Backup",
      details: { productsRestored, customersRestored },
    });

    return res.json({
      success: true,
      message: `Restoration complete: ${productsRestored} products, ${customersRestored} customers verified and updated.`,
      restored: {
        products: productsRestored,
        customers: customersRestored,
      },
    });
  } catch (err: any) {
    await t.rollback();
    return res.status(500).json({ success: false, message: `Backup restoration failed: ${err.message}` });
  }
}
