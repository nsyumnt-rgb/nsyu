import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Employee, EmployeeShop, Role, Shop, Attendance, Payroll, SalaryConfig } from "../models";
import { Op } from "sequelize";
import { logAudit } from "../utils/audit";

/** Owner-only: create a new employee (login credentials, not yet assigned to a shop). */
export async function createEmployee(req: Request, res: Response) {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "name, email and password are required" });
  }

  const existing = await Employee.findOne({ where: { owner_id: req.auth!.ownerId, email } });
  if (existing) {
    return res.status(409).json({ success: false, message: "An employee with this email already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const employee = await Employee.create({ owner_id: req.auth!.ownerId, name, email, password: hashed, phone });

  await logAudit({ req, module: "employees", action: "create", entityType: "Employee", entityId: employee.id });

  return res.status(201).json({
    success: true,
    data: { id: employee.id, name: employee.name, email: employee.email, phone: employee.phone },
  });
}

/** List all employees under this owner, with their shop+role assignments. */
export async function listEmployees(req: Request, res: Response) {
  const employees = await Employee.findAll({
    where: { owner_id: req.auth!.ownerId },
    attributes: { exclude: ["password"] },
    include: [
      {
        model: EmployeeShop,
        as: "shopAssignments",
        include: [{ model: Shop, as: "shop" }, { model: Role, as: "role" }],
      },
    ],
  });
  return res.json({ success: true, data: employees });
}

/** Get a single employee with shop/role assignments, salary config, recent attendance, and payroll. */
export async function getEmployee(req: Request, res: Response) {
  const param = String(req.params.employeeId).trim();
  const isNumeric = /^\d+$/.test(param);
  const where: any = { owner_id: req.auth!.ownerId };
  if (isNumeric) {
    where.id = Number(param);
  } else {
    where[Op.or] = [
      { email: { [Op.iLike]: param } },
      { name: { [Op.iLike]: param } },
    ];
  }

  const employee = await Employee.findOne({
    where,
    attributes: { exclude: ["password"] },
    include: [
      {
        model: EmployeeShop,
        as: "shopAssignments",
        include: [{ model: Shop, as: "shop" }, { model: Role, as: "role" }],
      },
      {
        model: SalaryConfig,
        as: "salaryConfigs",
      },
      {
        model: Attendance,
        as: "attendanceRecords",
        limit: 15,
        order: [["date", "DESC"]],
      },
      {
        model: Payroll,
        as: "payrolls",
        limit: 12,
        order: [["created_at", "DESC"]],
      },
    ],
  });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
  return res.json({ success: true, data: employee });
}

/**
 * Owner-only: assign (or update) an employee's role for a specific shop.
 * Because EmployeeShop has a unique (employee_id, shop_id) index, calling
 * this again for the same shop just changes their role there.
 */
export async function assignShopRole(req: Request, res: Response) {
  const { employeeId, shopId, roleId } = req.body;
  if (!employeeId || !shopId || !roleId) {
    return res.status(400).json({ success: false, message: "employeeId, shopId and roleId are required" });
  }

  const [employee, shop, role] = await Promise.all([
    Employee.findOne({ where: { id: employeeId, owner_id: req.auth!.ownerId } }),
    Shop.findOne({ where: { id: shopId, owner_id: req.auth!.ownerId } }),
    Role.findOne({ where: { id: roleId, owner_id: req.auth!.ownerId } }),
  ]);
  if (!employee || !shop || !role) {
    return res.status(404).json({ success: false, message: "Employee, shop or role not found" });
  }

  const [assignment] = await EmployeeShop.upsert({ employee_id: employeeId, shop_id: shopId, role_id: roleId });

  await logAudit({
    req,
    module: "employees",
    action: "assign_shop_role",
    entityType: "Employee",
    entityId: employeeId,
    details: { shopId, roleId },
  });

  return res.json({ success: true, data: assignment });
}

/** Owner-only: remove an employee's access to a shop. */
export async function removeShopAssignment(req: Request, res: Response) {
  const { employeeId, shopId } = req.body;
  await EmployeeShop.destroy({ where: { employee_id: employeeId, shop_id: shopId } });
  await logAudit({ req, module: "employees", action: "remove_shop_assignment", entityType: "Employee", entityId: employeeId });
  return res.json({ success: true, message: "Access removed" });
}

/** Owner-only: activate/deactivate an employee account. */
export async function setEmployeeStatus(req: Request, res: Response) {
  const employeeId = Number(req.params.employeeId);
  const { status } = req.body; // "active" | "inactive"

  const employee = await Employee.findOne({ where: { id: employeeId, owner_id: req.auth!.ownerId } });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

  const oldStatus = employee.status;
  employee.status = status;
  await employee.save();

  await logAudit({
    req,
    module: "employees",
    action: "employee_change",
    entityType: "Employee",
    entityId: employeeId,
    oldValue: { status: oldStatus },
    newValue: { status },
  });

  return res.json({ success: true, data: { id: employee.id, status: employee.status } });
}
