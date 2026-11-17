import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Owner, Role, RolePermission, RoleFieldPermission, RefreshToken, Shop, ShopModule, ShopPortalSettings, Employee } from "../models";
import { employeeAssignments, resolveEmployeeAccess } from "../utils/employeeAccess";
import sequelize from "../config/database";
import { signAccessToken, signRefreshToken, verifyRefreshToken, refreshExpiryDate } from "../utils/jwt";
import { seedOwnerDefaults } from "../utils/seed";
import { MODULES, SENSITIVE_FIELDS, toCanonicalModule } from "../config/permissions";

/**
 * Registers a brand-new Owner account. This is the entry point of
 * the whole system — everything else (shops, employees, roles,
 * products...) is created underneath this owner_id and is never
 * visible to any other owner.
 */
export async function registerOwner(req: Request, res: Response) {
  const { name, email, password, phone, shopName, shopCode, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "name, email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await Owner.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const owner = await Owner.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: hashed,
    phone: phone ? String(phone).trim() : null,
  });

  // Every new owner automatically gets the standard system roles
  // (Owner, Manager, Sales Staff, ...) with sensible default permissions.
  await seedOwnerDefaults(owner.id);

  // Automatically provision the owner's initial store/shop
  const cleanShopName = shopName && String(shopName).trim().length > 0
    ? String(shopName).trim()
    : `${String(name).trim()}'s Business`;

  let cleanShopCode = shopCode && String(shopCode).trim().length > 0
    ? String(shopCode).trim().toUpperCase()
    : "";
  if (!cleanShopCode) {
    const rawPrefix = cleanShopName.replace(/[^A-Za-z0-9]/g, "").substring(0, 4).toUpperCase();
    const prefix = rawPrefix.length > 0 ? rawPrefix : "NSYU";
    cleanShopCode = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const shop = await Shop.create({
    owner_id: owner.id,
    name: cleanShopName,
    code: cleanShopCode,
    phone: phone ? String(phone).trim() : null,
    email: normalizedEmail,
    address: address ? String(address).trim() : null,
    status: "pending_approval",
  });

  // Initialize Customer Portal settings for this shop
  try {
    await ShopPortalSettings.create({
      shop_id: shop.id,
      allow_self_registration: true,
      allow_orders: true,
      show_stock_qty: false,
      min_order_value: 0,
      allow_customer_cancel: true,
    });
  } catch (_) {}

  const accessToken = signAccessToken({ ownerId: owner.id, isOwner: true, shopId: shop.id, roleId: null });
  const refreshToken = signRefreshToken({ ownerId: owner.id });
  await RefreshToken.create({ token: refreshToken, owner_id: owner.id, expires_at: refreshExpiryDate() });

  return res.status(201).json({
    success: true,
    message: "Business account registered successfully. Your shop has been submitted for admin approval.",
    data: {
      owner: { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone },
      shop: { id: shop.id, name: shop.name, code: shop.code, status: shop.status },
      accessToken,
      refreshToken,
    },
  });
}

/**
 * Unified login: tries Owner first, then Employee (scoped to that
 * owner via email lookup). Employees log in with the same email
 * they were created with. Employee emails are unique platform-wide
 * (migrations/07) so the email alone identifies the account.
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "email and password are required" });
  }

  const lookupEmail = email.trim().toLowerCase();

  // Try Owner account first
  const owner = await Owner.findOne({ where: { email: lookupEmail } });
  if (owner) {
    const isPasswordMatch = await bcrypt.compare(password, owner.password);

    if (isPasswordMatch) {
      if (owner.status !== "active") {
        return res.status(403).json({ success: false, message: "Account suspended" });
      }

      if (owner.is_super_admin) {
        const accessToken = signAccessToken({
          ownerId: owner.id,
          isOwner: true,
          isSuperAdmin: true,
          roleName: "super_admin",
          shopId: null,
          roleId: null,
        });
        const refreshToken = signRefreshToken({ ownerId: owner.id });
        await RefreshToken.create({ token: refreshToken, owner_id: owner.id, expires_at: refreshExpiryDate() });

        return res.json({
          success: true,
          data: {
            accountType: "super_admin",
            isSuperAdmin: true,
            owner: {
              id: owner.id,
              name: owner.name,
              email: owner.email,
              is_super_admin: true,
              role: "super_admin",
            },
            shop: null,
            accessToken,
            refreshToken,
          },
        });
      }

      const shop = await Shop.findOne({ where: { owner_id: owner.id }, order: [["id", "ASC"]] });
      if (shop && shop.status === "suspended") {
        return res.status(403).json({
          success: false,
          message: "Shop is suspended. Access blocked. Contact system administrator.",
        });
      }

      const firstShop = shop && shop.status !== "suspended" ? shop : null;
      const defaultShopId = firstShop ? firstShop.id : null;

      const accessToken = signAccessToken({ ownerId: owner.id, isOwner: true, shopId: defaultShopId, roleId: null });
      const refreshToken = signRefreshToken({ ownerId: owner.id });
      await RefreshToken.create({ token: refreshToken, owner_id: owner.id, expires_at: refreshExpiryDate() });

      return res.json({
        success: true,
        data: {
          accountType: "owner",
          isSuperAdmin: false,
          owner: { id: owner.id, name: owner.name, email: owner.email, is_super_admin: false, role: owner.role },
          shop: firstShop,
          accessToken,
          refreshToken,
        },
      });
    }
  }

  // Employee (staff) account
  const employee = await Employee.findOne({
    where: sequelize.where(sequelize.fn("lower", sequelize.col("email")), lookupEmail),
  });
  if (employee && (await bcrypt.compare(password, employee.password))) {
    if (employee.status !== "active") {
      return res.status(403).json({ success: false, message: "Your staff account is inactive. Contact your shop owner." });
    }
    const assignments = await employeeAssignments(employee);
    if (assignments.length === 0) {
      return res.status(403).json({ success: false, message: "You are not assigned to any active shop yet. Ask your shop owner to assign you." });
    }
    // One shop → start there directly; several → the app shows the shop picker.
    const only: any = assignments.length === 1 ? assignments[0] : null;
    const accessToken = signAccessToken({
      ownerId: employee.owner_id,
      isOwner: false,
      employeeId: employee.id,
      shopId: only ? only.shop_id : null,
      roleId: only ? only.role_id : null,
    });
    const refreshToken = signRefreshToken({ ownerId: employee.owner_id, employeeId: employee.id });
    await RefreshToken.create({ token: refreshToken, employee_id: employee.id, owner_id: employee.owner_id, expires_at: refreshExpiryDate() });
    return res.json({
      success: true,
      data: {
        accountType: "employee",
        isSuperAdmin: false,
        employee: employee.toJSON(),
        shop: only ? only.shop : null,
        roleName: only ? only.role.name : null,
        assignedShopIds: assignments.map((a: any) => a.shop_id),
        accessToken,
        refreshToken,
      },
    });
  }

  return res.status(401).json({ success: false, message: "Invalid email or password" });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "refreshToken is required" });
  }

  const stored = await RefreshToken.findOne({ where: { token: refreshToken, revoked: false } });
  if (!stored || stored.expires_at < new Date()) {
    return res.status(401).json({ success: false, message: "Refresh token invalid or expired" });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const isOwner = !payload.employeeId;
    if (payload.employeeId) {
      const access = await resolveEmployeeAccess(payload.employeeId, payload.ownerId, null);
      if (!access.ok) return res.status(401).json({ success: false, message: "Staff account is no longer active" });
    }

    let roleId: number | null = null;
    let roleName: string | null = null;

    const accessToken = signAccessToken({
      ownerId: payload.ownerId,
      isOwner,
      employeeId: payload.employeeId,
      shopId: null, // shop context must be re-selected after refresh for safety
      roleId,
      roleName,
    });

    return res.json({ success: true, data: { accessToken } });
  } catch {
    return res.status(401).json({ success: false, message: "Refresh token invalid or expired" });
  }
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await RefreshToken.update({ revoked: true }, { where: { token: refreshToken } });
  }
  return res.json({ success: true, message: "Logged out" });
}

/**
 * ADDITIVE, non-breaking endpoint: returns everything the frontend
 * needs to render itself for the CURRENT actor + CURRENT shop
 * context — who they are, which shop/role they're scoped to, and
 * their resolved module + sensitive-field permission grid.
 *
 * This does not replace requirePermission() as the security
 * boundary (every write route still re-checks server-side) — it
 * only lets the UI hide/show nav items and fields without the
 * frontend having to duplicate the permission logic.
 */
export async function getMe(req: Request, res: Response) {
  const auth = req.auth!;

  // Build the full module permission grid.
  const permissions: Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }> = {};
  const fieldPermissions: Record<string, boolean> = {};

  if (auth.isOwner) {
    // Owner always has full access to everything under their own account.
    MODULES.forEach((m) => (permissions[m] = { can_view: true, can_create: true, can_edit: true, can_delete: true }));
    SENSITIVE_FIELDS.forEach((f) => (fieldPermissions[f] = true));
  } else {
    MODULES.forEach((m) => (permissions[m] = { can_view: false, can_create: false, can_edit: false, can_delete: false }));
    SENSITIVE_FIELDS.forEach((f) => (fieldPermissions[f] = false));

    if (auth.roleId) {
      const [rolePerms, fieldPerms] = await Promise.all([
        RolePermission.findAll({ where: { role_id: auth.roleId } }),
        RoleFieldPermission.findAll({ where: { role_id: auth.roleId } }),
      ]);
      // A module's own row always wins; an alias row (e.g. "dashboard" → "reports") only fills a
      // canonical key that has no row of its own. Otherwise the UI could show modules the API refuses.
      const direct = new Set(rolePerms.map((p) => p.module));
      rolePerms.forEach((p) => {
        const perm = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        };
        permissions[p.module] = perm;
        const canonical = toCanonicalModule(p.module);
        if (canonical !== p.module && !direct.has(canonical)) permissions[canonical] = perm;
      });
      fieldPerms.forEach((f) => (fieldPermissions[f.field] = f.allowed));

      // If shop has disabled any module via shop_modules, revoke access for staff
      if (auth.shopId) {
        try {
          const disabledShopMods = await ShopModule.findAll({ where: { shop_id: auth.shopId, is_enabled: false } });
          disabledShopMods.forEach((sm) => {
            permissions[sm.module_code] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
          });
        } catch {}
      }
    }
  }

  if (auth.isOwner) {
    const owner = await Owner.findByPk(auth.ownerId, { attributes: { exclude: ["password"] } });
    if (owner?.is_super_admin || auth.isSuperAdmin) {
      return res.json({
        success: true,
        data: {
          accountType: "super_admin",
          isSuperAdmin: true,
          owner,
          shopId: null,
          roleId: null,
          roleName: "super_admin",
          permissions,
          fieldPermissions,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        accountType: "owner",
        isSuperAdmin: false,
        owner,
        shopId: auth.shopId ?? null,
        roleId: null,
        roleName: "Owner",
        permissions,
        fieldPermissions,
      },
    });
  }

  if (auth.employeeId) {
    const employee = await Employee.findByPk(auth.employeeId);
    if (!employee || employee.status !== "active") return res.status(401).json({ success: false, message: "Invalid session" });
    const assignments = await employeeAssignments(employee);
    const current: any = assignments.find((a: any) => a.shop_id === auth.shopId);
    return res.json({
      success: true,
      data: {
        accountType: "employee",
        isSuperAdmin: false,
        employee: employee.toJSON(),
        shopId: current ? current.shop_id : null,
        roleId: current ? current.role_id : null,
        roleName: current ? current.role.name : null,
        assignedShopIds: assignments.map((a: any) => a.shop_id),
        permissions,
        fieldPermissions,
      },
    });
  }

  return res.status(401).json({ success: false, message: "Invalid session" });
}
