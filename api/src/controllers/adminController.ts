import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import sequelize from "../config/database";
import {
  Shop,
  Owner,
  Employee,
  Customer,
  Sale,
  Order,
  Product,
  ProductStock,
  PlatformAuditLog,
  StatusHistory,
  CustomerAccount,
} from "../models";
import { seedOwnerDefaults } from "../utils/seed";

/**
 * Helper to record Super Admin actions in the platform audit log.
 */
async function logSuperAdminAction(
  req: Request,
  action: string,
  targetType: string,
  targetId?: number | null,
  targetName?: string | null,
  details: Record<string, any> = {}
) {
  try {
    const superAdminId = req.auth?.ownerId || 0;
    const superAdminEmail = (req.auth as any)?.email || "superadmin@nsyu.com";
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    await PlatformAuditLog.create({
      super_admin_id: superAdminId,
      super_admin_email: superAdminEmail,
      action,
      target_type: targetType,
      target_id: targetId || null,
      target_name: targetName || null,
      details,
      ip_address: ipAddress.split(",")[0].trim(),
    });
  } catch (err) {
    console.error("Failed to write platform audit log:", err);
  }
}

/**
 * 1. GET /api/admin/dashboard
 * Real database queries: total shops, active/suspended shops, total users, total sales across platform.
 */
export async function getAdminDashboard(req: Request, res: Response) {
  try {
    const [
      totalShops,
      activeShops,
      suspendedShops,
      totalOwners,
      totalEmployees,
      totalCustomers,
      salesAgg,
      recentLogs,
    ] = await Promise.all([
      Shop.count(),
      Shop.count({ where: { status: "active" } }),
      Shop.count({ where: { status: "suspended" } }),
      Owner.count({ where: { is_super_admin: false } }),
      Employee.count(),
      Customer.count(),
      Sale.findOne({
        attributes: [
          [sequelize.fn("COUNT", sequelize.col("id")), "total_sales_count"],
          [sequelize.fn("COALESCE", sequelize.fn("SUM", sequelize.col("total_amount")), 0), "total_sales_amount"],
        ],
        where: { status: { [Op.ne]: "cancelled" } },
        raw: true,
      }) as any,
      PlatformAuditLog.findAll({
        order: [["created_at", "DESC"]],
        limit: 10,
      }),
    ]);

    const totalUsers = (totalOwners || 0) + (totalEmployees || 0) + (totalCustomers || 0);
    const totalSalesAmount = Number(salesAgg?.total_sales_amount || 0);
    const totalSalesCount = Number(salesAgg?.total_sales_count || 0);

    return res.json({
      success: true,
      data: {
        total_shops: totalShops,
        active_shops: activeShops,
        suspended_shops: suspendedShops,
        total_users: totalUsers,
        total_owners: totalOwners,
        total_employees: totalEmployees,
        total_customers: totalCustomers,
        total_sales_amount: totalSalesAmount,
        total_sales_count: totalSalesCount,
        recent_activity: recentLogs,
      },
    });
  } catch (error: any) {
    console.error("Error fetching admin dashboard:", error);
    return res.status(500).json({ success: false, message: "Failed to load dashboard metrics" });
  }
}

/**
 * 2. GET /api/admin/shops
 * List all shops with owner details and operational status.
 */
export async function getAdminShops(req: Request, res: Response) {
  try {
    const shops = await Shop.findAll({
      include: [
        {
          model: Owner,
          as: "owner",
          attributes: ["id", "name", "email", "phone", "status"],
        },
      ],
      order: [["id", "ASC"]],
    });

    return res.json({
      success: true,
      data: shops,
    });
  } catch (error: any) {
    console.error("Error fetching shops:", error);
    return res.status(500).json({ success: false, message: "Failed to load shops" });
  }
}

/**
 * 3. POST /api/admin/shops
 * Create a shop under an owner.
 */
export async function createAdminShop(req: Request, res: Response) {
  try {
    const { name, code, owner_id, address, phone, email } = req.body;

    if (!name || !code || !owner_id) {
      return res.status(400).json({ success: false, message: "name, code, and owner_id are required" });
    }

    const owner = await Owner.findByPk(owner_id);
    if (!owner) {
      return res.status(404).json({ success: false, message: "Owner not found" });
    }

    const existingCode = await Shop.findOne({ where: { owner_id, code: code.trim().toUpperCase() } });
    if (existingCode) {
      return res.status(409).json({ success: false, message: "Shop code already exists for this owner" });
    }

    const shop = await Shop.create({
      owner_id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      status: "active",
    });

    await logSuperAdminAction(
      req,
      "CREATE_SHOP",
      "shop",
      shop.id,
      shop.name,
      { code: shop.code, owner_id: shop.owner_id }
    );

    return res.status(201).json({
      success: true,
      message: "Shop created successfully",
      data: shop,
    });
  } catch (error: any) {
    console.error("Error creating shop:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create shop" });
  }
}

/**
 * 4. PUT /api/admin/shops/:id
 * Edit shop basics (name, address, phone, email).
 */
export async function updateAdminShop(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.id);
    const { name, address, phone, email } = req.body;

    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const oldData = { name: shop.name, address: shop.address, phone: shop.phone, email: shop.email };

    if (name) shop.name = name.trim();
    if (address !== undefined) shop.address = address ? address.trim() : null;
    if (phone !== undefined) shop.phone = phone ? phone.trim() : null;
    if (email !== undefined) shop.email = email ? email.trim() : null;

    await shop.save();

    await logSuperAdminAction(
      req,
      "UPDATE_SHOP",
      "shop",
      shop.id,
      shop.name,
      { old: oldData, updated: { name: shop.name, address: shop.address, phone: shop.phone, email: shop.email } }
    );

    return res.json({
      success: true,
      message: "Shop updated successfully",
      data: shop,
    });
  } catch (error: any) {
    console.error("Error updating shop:", error);
    return res.status(500).json({ success: false, message: "Failed to update shop" });
  }
}

/**
 * 5. PATCH /api/admin/shops/:id/status
 * Activate or suspend a shop.
 * Suspended shop blocks login and API access for all of its users.
 */
export async function toggleAdminShopStatus(req: Request, res: Response) {
  const transaction = await sequelize.transaction();
  try {
    const shopId = Number(req.params.id);
    const { status, reason } = req.body;

    if (!["active", "suspended"].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid status. Must be 'active' or 'suspended'" });
    }

    const shop = await Shop.findByPk(shopId, { transaction });
    if (!shop) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const oldStatus = shop.status;
    shop.status = status;
    await shop.save({ transaction });

    // Record in status_history
    await StatusHistory.create(
      {
        shop_id: shop.id,
        entity_type: "shop",
        entity_id: shop.id,
        old_status: oldStatus,
        new_status: status,
        changed_by_id: req.auth?.ownerId || 0,
        changed_by_role: "super_admin",
        reason: reason || `Shop status set to ${status} by Super Admin`,
      },
      { transaction }
    );

    await transaction.commit();

    // Log to platform audit log
    await logSuperAdminAction(
      req,
      status === "suspended" ? "SUSPEND_SHOP" : "ACTIVATE_SHOP",
      "shop",
      shop.id,
      shop.name,
      { old_status: oldStatus, new_status: status, reason }
    );

    return res.json({
      success: true,
      message: `Shop successfully ${status === "suspended" ? "suspended" : "activated"}`,
      data: shop,
    });
  } catch (error: any) {
    await transaction.rollback();
    console.error("Error changing shop status:", error);
    return res.status(500).json({ success: false, message: "Failed to update shop status" });
  }
}

/**
 * 6. GET /api/admin/owners
 * List all owners with shop count, status, and details.
 */
export async function getAdminOwners(req: Request, res: Response) {
  try {
    const owners = await Owner.findAll({
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Shop,
          as: "shops",
          attributes: ["id", "name", "code", "status"],
        },
      ],
      order: [["id", "ASC"]],
    });

    return res.json({
      success: true,
      data: owners,
    });
  } catch (error: any) {
    console.error("Error fetching owners:", error);
    return res.status(500).json({ success: false, message: "Failed to load owners" });
  }
}

/**
 * 7. POST /api/admin/owners
 * Create the first Owner for a shop.
 */
export async function createAdminOwner(req: Request, res: Response) {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Owner.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email is already registered as an Owner" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const owner = await Owner.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone?.trim() || null,
      status: "active",
      is_super_admin: false,
      role: "owner",
    });

    // Seed default roles and permissions for the new owner
    await seedOwnerDefaults(owner.id);

    await logSuperAdminAction(
      req,
      "CREATE_OWNER",
      "owner",
      owner.id,
      owner.name,
      { email: owner.email, phone: owner.phone }
    );

    const result = owner.toJSON();
    delete (result as any).password;

    return res.status(201).json({
      success: true,
      message: "Owner created successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error creating owner:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create owner" });
  }
}

/**
 * 8. PATCH /api/admin/owners/:id/password
 * Reset an Owner's password.
 */
export async function resetAdminOwnerPassword(req: Request, res: Response) {
  try {
    const ownerId = Number(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const owner = await Owner.findByPk(ownerId);
    if (!owner) {
      return res.status(404).json({ success: false, message: "Owner not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    owner.password = hashedPassword;
    await owner.save();

    await logSuperAdminAction(
      req,
      "RESET_OWNER_PASSWORD",
      "owner",
      owner.id,
      owner.name,
      { email: owner.email }
    );

    return res.json({
      success: true,
      message: "Password reset successfully for owner",
    });
  } catch (error: any) {
    console.error("Error resetting owner password:", error);
    return res.status(500).json({ success: false, message: "Failed to reset password" });
  }
}

/**
 * 9. PATCH /api/admin/owners/:id/status
 * Activate or deactivate an Owner.
 */
export async function toggleAdminOwnerStatus(req: Request, res: Response) {
  try {
    const ownerId = Number(req.params.id);
    const { status, reason } = req.body;

    if (!["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const owner = await Owner.findByPk(ownerId);
    if (!owner) {
      return res.status(404).json({ success: false, message: "Owner not found" });
    }

    if (owner.is_super_admin) {
      return res.status(403).json({ success: false, message: "Cannot modify status of a Super Admin account" });
    }

    const oldStatus = owner.status;
    owner.status = status as any;
    await owner.save();

    await logSuperAdminAction(
      req,
      "UPDATE_OWNER_STATUS",
      "owner",
      owner.id,
      owner.name,
      { old_status: oldStatus, new_status: status, reason }
    );

    return res.json({
      success: true,
      message: `Owner status updated to ${status}`,
      data: { id: owner.id, email: owner.email, status: owner.status },
    });
  } catch (error: any) {
    console.error("Error toggling owner status:", error);
    return res.status(500).json({ success: false, message: "Failed to update owner status" });
  }
}

/**
 * 10. GET /api/admin/audit-logs
 * List all platform audit logs.
 */
export async function getAdminAuditLogs(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await PlatformAuditLog.findAndCountAll({
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        logs: rows,
      },
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    return res.status(500).json({ success: false, message: "Failed to load audit logs" });
  }
}

/**
 * 11. GET /api/admin/shops/:id/data
 * Read-only support view of any shop's business data.
 * STRICTLY READ-ONLY — NO WRITES ALLOWED.
 */
export async function getAdminShopSupportData(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.id);
    const shop = await Shop.findByPk(shopId, {
      include: [
        {
          model: Owner,
          as: "owner",
          attributes: ["id", "name", "email", "phone"],
        },
      ],
    });

    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const [
      billsCount,
      ordersCount,
      customersCount,
      productsCount,
      recentBills,
      recentOrders,
      inventorySummary,
      customersList,
    ] = await Promise.all([
      Sale.count({ where: { shop_id: shopId } }),
      Order.count({ where: { shop_id: shopId } }),
      Customer.count({ where: { owner_id: shop.owner_id } }),
      ProductStock.count({ where: { shop_id: shopId } }),
      Sale.findAll({
        where: { shop_id: shopId },
        order: [["created_at", "DESC"]],
        limit: 15,
      }),
      Order.findAll({
        where: { shop_id: shopId },
        order: [["created_at", "DESC"]],
        limit: 15,
      }),
      ProductStock.findAll({
        where: { shop_id: shopId },
        include: [{ model: Product, as: "product" }],
        limit: 30,
      }),
      Customer.findAll({
        where: { owner_id: shop.owner_id },
        limit: 30,
      }),
    ]);

    await logSuperAdminAction(
      req,
      "VIEW_SHOP_SUPPORT_DATA",
      "shop",
      shop.id,
      shop.name,
      { shop_id: shop.id }
    );

    return res.json({
      success: true,
      data: {
        shop,
        stats: {
          billsCount,
          ordersCount,
          customersCount,
          productsCount,
        },
        recentBills,
        recentOrders,
        inventorySummary,
        customersList,
      },
    });
  } catch (error: any) {
    console.error("Error fetching shop support data:", error);
    return res.status(500).json({ success: false, message: "Failed to load shop support data" });
  }
}
