import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import sequelize from "../config/database";
import {
  Shop,
  Owner,
  Customer,
  Sale,
  Order,
  Product,
  ProductStock,
  PlatformAuditLog,
  StatusHistory,
  CustomerAccount,
  Notification,
  Employee,
  Category,
  Subcategory,
} from "../models";
import { seedOwnerDefaults } from "../utils/seed";
import { saveImage, removeImage } from "../utils/mediaStorage";

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
      pendingShops,
      totalOwners,
      totalEmployees,
      totalCustomers,
      salesAgg,
      recentLogs,
    ] = await Promise.all([
      Shop.count(),
      Shop.count({ where: { status: "active" } }),
      Shop.count({ where: { status: "suspended" } }),
      Shop.count({ where: { status: "pending_approval" } }),
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
        pending_shops: pendingShops,
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
 * Activate, suspend, or set a shop pending approval.
 * Suspended shop blocks login and API access for all of its users.
 */
export async function toggleAdminShopStatus(req: Request, res: Response) {
  const transaction = await sequelize.transaction();
  try {
    const shopId = Number(req.params.id);
    const { status, reason } = req.body;

    if (!["active", "suspended", "pending_approval"].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'active', 'suspended', or 'pending_approval'",
      });
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
        reason:
          reason ||
          (status === "active" && oldStatus === "pending_approval"
            ? "Approved by Super Admin"
            : `Shop status set to ${status} by Super Admin`),
      },
      { transaction }
    );

    await transaction.commit();

    const auditAction =
      status === "active"
        ? oldStatus === "pending_approval"
          ? "APPROVE_SHOP"
          : "ACTIVATE_SHOP"
        : status === "suspended"
        ? "SUSPEND_SHOP"
        : "SET_SHOP_PENDING";

    // Log to platform audit log
    await logSuperAdminAction(
      req,
      auditAction,
      "shop",
      shop.id,
      shop.name,
      { old_status: oldStatus, new_status: status, reason }
    );

    // If shop was approved, notify the owner
    if (status === "active" && oldStatus === "pending_approval") {
      try {
        await Notification.create({
          owner_id: shop.owner_id,
          shop_id: shop.id,
          recipient_type: "owner",
          recipient_id: shop.owner_id,
          type: "general",
          title: "Shop Approved!",
          message: `Your shop "${shop.name}" (${shop.code}) has been approved by the platform administrator and is now live. Note: ${reason || "Welcome to NSYU platform!"}`,
          reference_type: "shop",
          reference_id: shop.id,
          is_read: false,
        });
      } catch {}
    } else if (status === "suspended" && oldStatus === "pending_approval") {
      try {
        await Notification.create({
          owner_id: shop.owner_id,
          shop_id: shop.id,
          recipient_type: "owner",
          recipient_id: shop.owner_id,
          type: "general",
          title: "Shop Registration Rejected",
          message: `Your shop "${shop.name}" (${shop.code}) could not be approved at this time. Reason: ${reason || "Information verification required."}`,
          reference_type: "shop",
          reference_id: shop.id,
          is_read: false,
        });
      } catch {}
    }

    const successMessage =
      status === "active"
        ? oldStatus === "pending_approval"
          ? "Shop approved and activated successfully"
          : "Shop successfully activated"
        : status === "suspended"
        ? oldStatus === "pending_approval"
          ? "Shop registration rejected"
          : "Shop successfully suspended"
        : "Shop status set to pending approval";

    return res.json({
      success: true,
      message: successMessage,
      data: shop,
    });
  } catch (error: any) {
    await transaction.rollback();
    console.error("Error changing shop status:", error);
    return res.status(500).json({ success: false, message: "Failed to update shop status" });
  }
}

/**
 * Quick approval endpoint for Super Admin:
 * POST /api/admin/shops/:id/approve
 */
export async function approveAdminShop(req: Request, res: Response) {
  req.body.status = "active";
  req.body.reason = req.body.reason || "Approved by Super Admin";
  return toggleAdminShopStatus(req, res);
}

/**
 * Rejection endpoint for Super Admin:
 * POST /api/admin/shops/:id/reject
 */
export async function rejectAdminShop(req: Request, res: Response) {
  const { reason } = req.body;
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: "A reason is required to reject a shop registration." });
  }
  req.body.status = "suspended";
  req.body.reason = `Registration Rejected: ${String(reason).trim()}`;
  return toggleAdminShopStatus(req, res);
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
 * List all platform audit logs with search and action filters.
 */
export async function getAdminAuditLogs(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const where: any = {};
    const { action, search, target_type } = req.query;

    if (action && action !== "all") {
      where.action = action;
    }
    if (target_type && target_type !== "all") {
      where.target_type = target_type;
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [
        { super_admin_email: { [Op.iLike]: q } },
        { target_name: { [Op.iLike]: q } },
        { action: { [Op.iLike]: q } },
        { ip_address: { [Op.iLike]: q } },
      ];
    }

    const { count, rows } = await PlatformAuditLog.findAndCountAll({
      where,
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

/**
 * 12. GET /api/admin/categories
 * List all master platform categories across all owners with item counts.
 */
export async function getAdminCategories(req: Request, res: Response) {
  try {
    const categories = await Category.findAll({
      include: [
        { model: Owner, as: "owner", attributes: ["id", "name", "email"] },
        { model: Subcategory, as: "subcategories" },
      ],
      order: [["name", "ASC"]],
    });

    const categoryIds = categories.map((c) => c.id);
    const counts = (await Product.findAll({
      attributes: ["category_id", [sequelize.fn("COUNT", sequelize.col("id")), "product_count"]],
      where: { category_id: categoryIds },
      group: ["category_id"],
      raw: true,
    })) as any[];

    const countMap: Record<number, number> = {};
    for (const r of counts) {
      if (r.category_id) countMap[Number(r.category_id)] = Number(r.product_count);
    }

    const data = categories.map((c) => {
      const json = c.toJSON() as any;
      json.product_count = countMap[c.id] || 0;
      return json;
    });

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching admin categories:", error);
    return res.status(500).json({ success: false, message: "Failed to load categories" });
  }
}

/**
 * 13. POST /api/admin/categories
 * Create a new master category.
 */
export async function createAdminCategory(req: Request, res: Response) {
  try {
    const { name, alias, icon, image_url, status, owner_id } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const targetOwnerId = owner_id || req.auth?.ownerId || 1;
    const trimmedName = String(name).trim();

    const category = await Category.create({
      owner_id: targetOwnerId,
      name: trimmedName,
      alias: alias ? String(alias).trim().toUpperCase() : null,
      icon: icon ? String(icon).trim() : null,
      image_url: image_url ? String(image_url).trim() : null,
      status: status === "inactive" ? "inactive" : "active",
    });

    await logSuperAdminAction(
      req,
      "CREATE_CATEGORY",
      "category",
      category.id,
      category.name,
      { alias: category.alias, status: category.status }
    );

    return res.status(201).json({ success: true, message: "Category created successfully", data: category });
  } catch (error: any) {
    console.error("Error creating category:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create category" });
  }
}

/**
 * 14. PUT /api/admin/categories/:id
 * Update a master category.
 */
export async function updateAdminCategory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const { name, alias, icon, image_url, status } = req.body;
    if (name && String(name).trim()) category.name = String(name).trim();
    if (alias !== undefined) category.alias = alias ? String(alias).trim().toUpperCase() : null;
    if (icon !== undefined) category.icon = icon ? String(icon).trim() : null;
    if (image_url !== undefined) category.image_url = image_url ? String(image_url).trim() : null;
    if (status && (status === "active" || status === "inactive")) category.status = status;

    await category.save();

    await logSuperAdminAction(
      req,
      "UPDATE_CATEGORY",
      "category",
      category.id,
      category.name,
      { alias: category.alias, status: category.status }
    );

    return res.json({ success: true, message: "Category updated successfully", data: category });
  } catch (error: any) {
    console.error("Error updating category:", error);
    return res.status(500).json({ success: false, message: "Failed to update category" });
  }
}

/**
 * 15. DELETE /api/admin/categories/:id
 * Delete a master category.
 */
export async function deleteAdminCategory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Unlink products
    await Product.update({ category_id: null }, { where: { category_id: id } });
    await Subcategory.destroy({ where: { category_id: id } });
    const oldUrl = category.image_url;
    await category.destroy();
    if (oldUrl) await removeImage(oldUrl);

    await logSuperAdminAction(
      req,
      "DELETE_CATEGORY",
      "category",
      id,
      category.name
    );

    return res.json({ success: true, message: "Category deleted successfully", data: { id } });
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return res.status(500).json({ success: false, message: "Failed to delete category" });
  }
}

/**
 * 16. POST /api/admin/categories/:id/image
 * Upload category icon / PNG image.
 */
export async function uploadAdminCategoryImage(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ success: false, message: "Choose an image file to upload" });
    }

    const url = await saveImage(file, `platform/categories/${category.id}`);
    const oldUrl = category.image_url;
    category.image_url = url;
    await category.save();
    if (oldUrl) await removeImage(oldUrl);

    await logSuperAdminAction(
      req,
      "UPLOAD_CATEGORY_IMAGE",
      "category",
      category.id,
      category.name,
      { image_url: url }
    );

    return res.json({ success: true, message: "Category image uploaded", data: { imageUrl: url, category } });
  } catch (error: any) {
    console.error("Error uploading category image:", error);
    return res.status(500).json({ success: false, message: error?.message || "Failed to upload image" });
  }
}

/**
 * 17. GET /api/admin/notifications
 * List platform sent notifications.
 */
export async function getAdminNotifications(req: Request, res: Response) {
  try {
    const notifications = await Notification.findAll({
      order: [["created_at", "DESC"]],
      limit: 100,
    });
    return res.json({
      success: true,
      data: notifications,
    });
  } catch (error: any) {
    console.error("Error fetching admin notifications:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
}

/**
 * 18. POST /api/admin/notifications/broadcast
 * Broadcast notification to all owners, all staff, all customers, or a specific owner.
 */
export async function broadcastAdminNotification(req: Request, res: Response) {
  try {
    const { target_audience, owner_id, title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    let createdCount = 0;
    const notifType = type || "general";

    if (target_audience === "specific_owner" && owner_id) {
      await Notification.create({
        owner_id: Number(owner_id),
        recipient_type: "owner",
        recipient_id: Number(owner_id),
        type: notifType,
        title: String(title).trim(),
        message: String(message).trim(),
        is_read: false,
      });
      createdCount = 1;
    } else if (target_audience === "all_employees") {
      const employees = await Employee.findAll({ attributes: ["id", "owner_id"] });
      const notifs = employees.map((e) => ({
        owner_id: e.owner_id,
        recipient_type: "employee" as const,
        recipient_id: e.id,
        type: notifType,
        title: String(title).trim(),
        message: String(message).trim(),
        is_read: false,
      }));
      if (notifs.length > 0) await Notification.bulkCreate(notifs);
      createdCount = notifs.length;
    } else if (target_audience === "all_customers") {
      const customers = await Customer.findAll({ attributes: ["id", "owner_id"] });
      const notifs = customers.map((c) => ({
        owner_id: c.owner_id,
        recipient_type: "customer" as const,
        recipient_id: c.id,
        type: notifType,
        title: String(title).trim(),
        message: String(message).trim(),
        is_read: false,
      }));
      if (notifs.length > 0) await Notification.bulkCreate(notifs);
      createdCount = notifs.length;
    } else {
      // Default: all_owners
      const owners = await Owner.findAll({ attributes: ["id"] });
      const notifs = owners.map((o) => ({
        owner_id: o.id,
        recipient_type: "owner" as const,
        recipient_id: o.id,
        type: notifType,
        title: String(title).trim(),
        message: String(message).trim(),
        is_read: false,
      }));
      if (notifs.length > 0) await Notification.bulkCreate(notifs);
      createdCount = notifs.length;
    }

    await logSuperAdminAction(
      req,
      "BROADCAST_NOTIFICATION",
      "notification",
      null,
      String(title).trim(),
      { target_audience: target_audience || "all_owners", count: createdCount, message }
    );

    return res.json({
      success: true,
      message: `Notification broadcast sent to ${createdCount} recipient(s)`,
      data: { count: createdCount },
    });
  } catch (error: any) {
    console.error("Error broadcasting notification:", error);
    return res.status(500).json({ success: false, message: "Failed to broadcast notification" });
  }
}

