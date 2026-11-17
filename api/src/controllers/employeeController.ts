import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Employee, Owner, RefreshToken, Role, Shop, UserRole } from "../models";
import sequelize from "../config/database";
import { logAudit } from "../utils/audit";

/* Owner-only staff account management. Every lookup is scoped to the calling owner. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Platform / owner / customer roles exist per owner but are never staff roles. */
const NON_STAFF_ROLES = ["Owner", "Super Admin", "User"];

async function withAssignments(employee: Employee) {
  const rows: any[] = await UserRole.findAll({
    where: { user_type: "employee", user_id: employee.id },
    include: [
      { model: Shop, as: "shop", attributes: ["id", "name", "code", "status", "owner_id"] },
      { model: Role, as: "role", attributes: ["id", "name", "owner_id"] },
    ],
    order: [["id", "ASC"]],
  });
  return {
    ...employee.toJSON(),
    shopAssignments: rows
      .filter((r) => r.shop?.owner_id === employee.owner_id)
      .map((r) => ({ id: r.id, employee_id: employee.id, shop_id: r.shop_id, role_id: r.role_id, is_active: r.is_active, shop: r.shop, role: r.role })),
  };
}

async function ownEmployee(req: Request, id: unknown) {
  const employee = await Employee.findByPk(Number(id));
  return employee && employee.owner_id === req.auth!.ownerId ? employee : null;
}

async function emailTaken(email: string, exceptEmployeeId?: number) {
  const lower = email.toLowerCase();
  const owner = await Owner.findOne({ where: sequelize.where(sequelize.fn("lower", sequelize.col("email")), lower) });
  if (owner) return true;
  const emp = await Employee.findOne({ where: sequelize.where(sequelize.fn("lower", sequelize.col("email")), lower) });
  return Boolean(emp && emp.id !== exceptEmployeeId);
}

/** Validates that the shop and role both belong to the caller and the role is a staff role. */
async function validateShopRole(ownerId: number, shopId: unknown, roleId: unknown) {
  const shop = await Shop.findByPk(Number(shopId));
  if (!shop || shop.owner_id !== ownerId) return { error: "Shop not found" };
  const role = await Role.findByPk(Number(roleId));
  if (!role || role.owner_id !== ownerId) return { error: "Role not found" };
  if (NON_STAFF_ROLES.includes(role.name)) return { error: `The "${role.name}" role cannot be given to staff` };
  return { shop, role };
}

export async function listEmployees(req: Request, res: Response) {
  const employees = await Employee.findAll({ where: { owner_id: req.auth!.ownerId }, order: [["name", "ASC"]] });
  const data = await Promise.all(employees.map(withAssignments));
  return res.json({ success: true, data });
}

export async function getEmployee(req: Request, res: Response) {
  const employee = await ownEmployee(req, req.params.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: "Staff member not found" });
  return res.json({ success: true, data: await withAssignments(employee) });
}

export async function createEmployee(req: Request, res: Response) {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = req.body.phone ? String(req.body.phone).trim() : null;
  const password = String(req.body.password || "");
  if (!name) return res.status(400).json({ success: false, message: "Name is required" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: "A valid email is required" });
  if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
  if (await emailTaken(email)) return res.status(409).json({ success: false, message: "This email is already used by another account" });

  let shopRole: any = null;
  if (req.body.shopId || req.body.roleId) {
    shopRole = await validateShopRole(req.auth!.ownerId, req.body.shopId, req.body.roleId);
    if (shopRole.error) return res.status(400).json({ success: false, message: shopRole.error });
  }

  const employee = await sequelize.transaction(async (t) => {
    const e = await Employee.create({ owner_id: req.auth!.ownerId, name, email, phone, password: await bcrypt.hash(password, 10), status: "active" }, { transaction: t });
    if (shopRole) await UserRole.create({ user_type: "employee", user_id: e.id, shop_id: shopRole.shop.id, role_id: shopRole.role.id, is_active: true }, { transaction: t });
    return e;
  });
  await logAudit({ req, module: "employees", action: "create", entityType: "Employee", entityId: employee.id });
  return res.status(201).json({ success: true, data: await withAssignments(employee) });
}

export async function updateEmployee(req: Request, res: Response) {
  const employee = await ownEmployee(req, req.params.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: "Staff member not found" });
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });
    employee.name = name;
  }
  if (req.body.phone !== undefined) employee.phone = req.body.phone ? String(req.body.phone).trim() : null;
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: "A valid email is required" });
    if (await emailTaken(email, employee.id)) return res.status(409).json({ success: false, message: "This email is already used by another account" });
    employee.email = email;
  }
  await employee.save();
  await logAudit({ req, module: "employees", action: "update", entityType: "Employee", entityId: employee.id });
  return res.json({ success: true, data: await withAssignments(employee) });
}

export async function resetEmployeePassword(req: Request, res: Response) {
  const employee = await ownEmployee(req, req.params.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: "Staff member not found" });
  const password = String(req.body.password || "");
  if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
  employee.password = await bcrypt.hash(password, 10);
  await employee.save();
  // Sign the staff member out everywhere.
  await RefreshToken.update({ revoked: true }, { where: { employee_id: employee.id } });
  await logAudit({ req, module: "employees", action: "reset_password", entityType: "Employee", entityId: employee.id });
  return res.json({ success: true, message: "Password updated. The staff member must sign in again." });
}

export async function setEmployeeStatus(req: Request, res: Response) {
  const employee = await ownEmployee(req, req.params.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: "Staff member not found" });
  const status = req.body.status;
  if (status !== "active" && status !== "inactive") return res.status(400).json({ success: false, message: "status must be active or inactive" });
  employee.status = status;
  await employee.save();
  if (status === "inactive") await RefreshToken.update({ revoked: true }, { where: { employee_id: employee.id } });
  await logAudit({ req, module: "employees", action: status === "active" ? "activate" : "deactivate", entityType: "Employee", entityId: employee.id });
  return res.json({ success: true, data: { id: employee.id, status } });
}

export async function assignShop(req: Request, res: Response) {
  const employee = await ownEmployee(req, req.body.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: "Staff member not found" });
  const v: any = await validateShopRole(req.auth!.ownerId, req.body.shopId, req.body.roleId);
  if (v.error) return res.status(400).json({ success: false, message: v.error });
  const existing = await UserRole.findOne({ where: { user_type: "employee", user_id: employee.id, shop_id: v.shop.id } });
  if (existing) {
    existing.role_id = v.role.id;
    existing.is_active = true;
    await existing.save();
  } else {
    await UserRole.create({ user_type: "employee", user_id: employee.id, shop_id: v.shop.id, role_id: v.role.id, is_active: true });
  }
  await logAudit({ req, module: "employees", action: "assign_shop", entityType: "Employee", entityId: employee.id });
  return res.json({ success: true, data: await withAssignments(employee) });
}

export async function removeShop(req: Request, res: Response) {
  const employee = await ownEmployee(req, req.body.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: "Staff member not found" });
  const shop = await Shop.findByPk(Number(req.body.shopId));
  if (!shop || shop.owner_id !== req.auth!.ownerId) return res.status(404).json({ success: false, message: "Shop not found" });
  await UserRole.destroy({ where: { user_type: "employee", user_id: employee.id, shop_id: shop.id } });
  await logAudit({ req, module: "employees", action: "remove_shop", entityType: "Employee", entityId: employee.id });
  return res.json({ success: true, data: await withAssignments(employee) });
}
