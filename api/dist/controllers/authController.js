"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOwner = registerOwner;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.getMe = getMe;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("../models");
const jwt_1 = require("../utils/jwt");
const seed_1 = require("../utils/seed");
const permissions_1 = require("../config/permissions");
/**
 * Registers a brand-new Owner account. This is the entry point of
 * the whole system — everything else (shops, employees, roles,
 * products...) is created underneath this owner_id and is never
 * visible to any other owner.
 */
async function registerOwner(req, res) {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: "name, email and password are required" });
    }
    const existing = await models_1.Owner.findOne({ where: { email } });
    if (existing) {
        return res.status(409).json({ success: false, message: "Email already registered" });
    }
    const hashed = await bcryptjs_1.default.hash(password, 10);
    const owner = await models_1.Owner.create({ name, email, password: hashed, phone });
    // Every new owner automatically gets the standard system roles
    // (Owner, Manager, Sales Staff, ...) with sensible default permissions.
    await (0, seed_1.seedOwnerDefaults)(owner.id);
    const accessToken = (0, jwt_1.signAccessToken)({ ownerId: owner.id, isOwner: true, shopId: null, roleId: null });
    const refreshToken = (0, jwt_1.signRefreshToken)({ ownerId: owner.id });
    await models_1.RefreshToken.create({ token: refreshToken, owner_id: owner.id, expires_at: (0, jwt_1.refreshExpiryDate)() });
    return res.status(201).json({
        success: true,
        data: {
            owner: { id: owner.id, name: owner.name, email: owner.email },
            accessToken,
            refreshToken,
        },
    });
}
/**
 * Unified login: tries Owner first, then Employee (scoped to that
 * owner via email lookup). Employees log in with the same email
 * they were created with — email is unique per-owner, not globally,
 * so the same email CAN exist under two different owners without
 * collision.
 */
async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "email and password are required" });
    }
    const lookupEmail = email.trim().toLowerCase();
    // Try Owner account first
    const owner = await models_1.Owner.findOne({ where: { email: lookupEmail } });
    if (owner) {
        const isPasswordMatch = await bcryptjs_1.default.compare(password, owner.password);
        if (isPasswordMatch) {
            if (owner.status !== "active") {
                return res.status(403).json({ success: false, message: "Account suspended" });
            }
            const firstShop = await models_1.Shop.findOne({ where: { owner_id: owner.id, status: "active" }, order: [["id", "ASC"]] });
            const defaultShopId = firstShop ? firstShop.id : null;
            const accessToken = (0, jwt_1.signAccessToken)({ ownerId: owner.id, isOwner: true, shopId: defaultShopId, roleId: null });
            const refreshToken = (0, jwt_1.signRefreshToken)({ ownerId: owner.id });
            await models_1.RefreshToken.create({ token: refreshToken, owner_id: owner.id, expires_at: (0, jwt_1.refreshExpiryDate)() });
            return res.json({
                success: true,
                data: {
                    accountType: "owner",
                    owner: { id: owner.id, name: owner.name, email: owner.email },
                    shop: firstShop,
                    accessToken,
                    refreshToken,
                },
            });
        }
    }
    // Fall back to Employee accounts
    const employee = await models_1.Employee.findOne({ where: { email: lookupEmail } });
    if (employee) {
        const isEmpMatch = await bcryptjs_1.default.compare(password, employee.password);
        if (isEmpMatch) {
            if (employee.status !== "active") {
                return res.status(403).json({ success: false, message: "Account disabled. Contact your owner." });
            }
            const shopAssignments = await models_1.EmployeeShop.findAll({
                where: { employee_id: employee.id },
                include: [{ model: models_1.Shop, as: "shop" }, { model: models_1.Role, as: "role" }],
            });
            const firstAssignment = shopAssignments[0];
            const defaultShopId = firstAssignment?.shop_id ?? null;
            const defaultRoleId = firstAssignment?.role_id ?? null;
            const defaultRoleName = firstAssignment?.role?.name ?? null;
            const accessToken = (0, jwt_1.signAccessToken)({
                ownerId: employee.owner_id,
                isOwner: false,
                employeeId: employee.id,
                shopId: defaultShopId,
                roleId: defaultRoleId,
                roleName: defaultRoleName,
            });
            const refreshToken = (0, jwt_1.signRefreshToken)({ ownerId: employee.owner_id, employeeId: employee.id });
            await models_1.RefreshToken.create({
                token: refreshToken,
                employee_id: employee.id,
                expires_at: (0, jwt_1.refreshExpiryDate)(),
            });
            return res.json({
                success: true,
                data: {
                    accountType: "employee",
                    employee: { id: employee.id, name: employee.name, email: employee.email },
                    shop: firstAssignment?.shop ?? null,
                    assignedShopIds: shopAssignments.map((a) => a.shop_id),
                    accessToken,
                    refreshToken,
                },
            });
        }
    }
    return res.status(401).json({ success: false, message: "Invalid email or password" });
}
async function refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ success: false, message: "refreshToken is required" });
    }
    const stored = await models_1.RefreshToken.findOne({ where: { token: refreshToken, revoked: false } });
    if (!stored || stored.expires_at < new Date()) {
        return res.status(401).json({ success: false, message: "Refresh token invalid or expired" });
    }
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const isOwner = !payload.employeeId;
        let roleId = null;
        let roleName = null;
        const accessToken = (0, jwt_1.signAccessToken)({
            ownerId: payload.ownerId,
            isOwner,
            employeeId: payload.employeeId,
            shopId: null, // shop context must be re-selected after refresh for safety
            roleId,
            roleName,
        });
        return res.json({ success: true, data: { accessToken } });
    }
    catch {
        return res.status(401).json({ success: false, message: "Refresh token invalid or expired" });
    }
}
async function logout(req, res) {
    const { refreshToken } = req.body;
    if (refreshToken) {
        await models_1.RefreshToken.update({ revoked: true }, { where: { token: refreshToken } });
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
async function getMe(req, res) {
    const auth = req.auth;
    // Build the full module permission grid.
    const permissions = {};
    const fieldPermissions = {};
    if (auth.isOwner) {
        // Owner always has full access to everything under their own account.
        permissions_1.MODULES.forEach((m) => (permissions[m] = { can_view: true, can_create: true, can_edit: true, can_delete: true }));
        permissions_1.SENSITIVE_FIELDS.forEach((f) => (fieldPermissions[f] = true));
    }
    else {
        permissions_1.MODULES.forEach((m) => (permissions[m] = { can_view: false, can_create: false, can_edit: false, can_delete: false }));
        permissions_1.SENSITIVE_FIELDS.forEach((f) => (fieldPermissions[f] = false));
        if (auth.roleId) {
            const [rolePerms, fieldPerms] = await Promise.all([
                models_1.RolePermission.findAll({ where: { role_id: auth.roleId } }),
                models_1.RoleFieldPermission.findAll({ where: { role_id: auth.roleId } }),
            ]);
            rolePerms.forEach((p) => {
                const perm = {
                    can_view: p.can_view,
                    can_create: p.can_create,
                    can_edit: p.can_edit,
                    can_delete: p.can_delete,
                };
                permissions[p.module] = perm;
                const canonical = (0, permissions_1.toCanonicalModule)(p.module);
                permissions[canonical] = perm;
            });
            fieldPerms.forEach((f) => (fieldPermissions[f.field] = f.allowed));
            // If shop has disabled any module via shop_modules, revoke access for staff
            if (auth.shopId) {
                try {
                    const disabledShopMods = await models_1.ShopModule.findAll({ where: { shop_id: auth.shopId, is_enabled: false } });
                    disabledShopMods.forEach((sm) => {
                        permissions[sm.module_code] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
                    });
                }
                catch { }
            }
        }
    }
    if (auth.isOwner) {
        const owner = await models_1.Owner.findByPk(auth.ownerId, { attributes: { exclude: ["password"] } });
        return res.json({
            success: true,
            data: {
                accountType: "owner",
                owner,
                shopId: auth.shopId ?? null,
                roleId: null,
                roleName: "Owner",
                permissions,
                fieldPermissions,
            },
        });
    }
    const employee = await models_1.Employee.findByPk(auth.employeeId, { attributes: { exclude: ["password"] } });
    const shopAssignments = await models_1.EmployeeShop.findAll({ where: { employee_id: auth.employeeId } });
    return res.json({
        success: true,
        data: {
            accountType: "employee",
            employee,
            shopId: auth.shopId ?? null,
            roleId: auth.roleId ?? null,
            roleName: auth.roleName ?? null,
            assignedShopIds: shopAssignments.map((a) => a.shop_id),
            permissions,
            fieldPermissions,
        },
    });
}
//# sourceMappingURL=authController.js.map