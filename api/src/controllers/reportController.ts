import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  Sale,
  SaleItem,
  SaleReturn,
  Payment,
  Customer,
  CustomerLedger,
  Product,
  ProductStock,
  InventoryTransaction,
  Supplier,
  SupplierLedger,
  Purchase,
  Shop,
  Attendance,
  Payroll,
  SalaryPayment,
  EmployeeAdvance,
  Employee,
  EmployeeShop,
  EMIPlan,
  EMIInstallment,
} from "../models";
import { getAllowedFields } from "../middleware/permission";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Every report is scoped to the current owner. If the actor is the
 * Owner AND no shopId query param is given, the report is
 * consolidated across ALL of the owner's shops (per spec: "Owner
 * must be able to see... shop-wise... reports"). An employee is
 * always pinned to their current shop context regardless of any
 * shopId they pass — this is the shop-isolation boundary, enforced
 * here so no report route can be used to peek at another shop's data.
 */
function resolveShopScope(req: Request): { shopId?: number } {
  if (!req.auth!.isOwner) {
    return { shopId: req.auth!.shopId! };
  }
  if (req.query.allShops === "true") {
    return { shopId: undefined };
  }
  const requested = req.query.shopId ? Number(req.query.shopId) : req.auth!.shopId ?? undefined;
  return { shopId: requested };
}

function dateRangeWhere(field: string, req: Request) {
  const { from, to } = req.query;
  if (!from && !to) return undefined;
  const where: any = {};
  if (from) where[Op.gte] = new Date(String(from));
  if (to) {
    const toDate = new Date(String(to));
    toDate.setHours(23, 59, 59, 999);
    where[Op.lte] = toDate;
  }
  return { [field]: where };
}

function dateOnlyRangeWhere(field: string, req: Request) {
  const { from, to } = req.query;
  if (!from && !to) return undefined;
  const where: any = {};
  if (from) where[Op.gte] = String(from);
  if (to) where[Op.lte] = String(to);
  return { [field]: where };
}

/** Resolves which employee ids the current actor may see: owner = everyone; employee = only staff assigned to their current shop (shop isolation for employee-wise reports). Returns undefined for "no filter" (owner). */
async function getVisibleEmployeeIds(req: Request): Promise<number[] | undefined> {
  if (req.auth!.isOwner) return undefined;
  const assignments = await EmployeeShop.findAll({ where: { shop_id: req.auth!.shopId! } });
  return assignments.map((a) => a.employee_id);
}

/** SALES REPORT — revenue, discount, tax, due, payment-method mix, over the period. */
export async function salesReport(req: Request, res: Response) {
  const { shopId } = resolveShopScope(req);
  const where: any = { owner_id: req.auth!.ownerId, status: { [Op.ne]: "cancelled" } };
  if (shopId) where.shop_id = shopId;
  Object.assign(where, dateRangeWhere("invoice_date", req) ?? {});

  const sales = await Sale.findAll({
    where,
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name"] },
      { model: Shop, as: "shop", attributes: ["id", "name"] },
    ],
    order: [["invoice_date", "DESC"]],
  });

  const summary = sales.reduce(
    (acc, s) => {
      acc.count += 1;
      acc.subtotal = round2(acc.subtotal + Number(s.subtotal));
      acc.discount = round2(acc.discount + Number(s.discount_amount));
      acc.tax = round2(acc.tax + Number(s.tax_amount));
      acc.total = round2(acc.total + Number(s.total_amount));
      acc.paid = round2(acc.paid + Number(s.paid_amount));
      acc.due = round2(acc.due + Number(s.due_amount));
      acc.byMethod[s.payment_method] = round2((acc.byMethod[s.payment_method] || 0) + Number(s.total_amount));
      return acc;
    },
    { count: 0, subtotal: 0, discount: 0, tax: 0, total: 0, paid: 0, due: 0, byMethod: {} as Record<string, number> }
  );

  return res.json({ success: true, data: { summary, sales } });
}

/** PURCHASE REPORT — real purchase totals now that the Purchase module exists (Purchase/PurchaseItem, actual historical rate/discount/tax per line). */
export async function purchaseReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["purchase_price"]);
  if (!allowed.purchase_price) {
    return res.status(403).json({ success: false, message: "You do not have permission to view purchase cost data" });
  }

  const { shopId } = resolveShopScope(req);
  const where: any = { owner_id: req.auth!.ownerId, status: { [Op.ne]: "cancelled" } };
  if (shopId) where.shop_id = shopId;
  Object.assign(where, dateRangeWhere("purchase_date", req) ?? {});

  const purchases = await Purchase.findAll({
    where,
    include: [{ model: Supplier, as: "supplier", attributes: ["id", "name"] }],
    order: [["purchase_date", "DESC"]],
  });

  const summary = purchases.reduce(
    (acc, p) => {
      acc.count += 1;
      acc.subtotal = round2(acc.subtotal + Number(p.subtotal));
      acc.discount = round2(acc.discount + Number(p.discount_amount));
      acc.tax = round2(acc.tax + Number(p.tax_amount));
      acc.total = round2(acc.total + Number(p.total_amount));
      acc.paid = round2(acc.paid + Number(p.paid_amount));
      acc.due = round2(acc.due + Number(p.due_amount));
      return acc;
    },
    { count: 0, subtotal: 0, discount: 0, tax: 0, total: 0, paid: 0, due: 0 }
  );

  const bySupplier: Record<string, { supplierId: number; name: string; total: number; count: number }> = {};
  for (const p of purchases as any[]) {
    const key = String(p.supplier_id);
    if (!bySupplier[key]) bySupplier[key] = { supplierId: p.supplier_id, name: p.supplier?.name, total: 0, count: 0 };
    bySupplier[key].total = round2(bySupplier[key].total + Number(p.total_amount));
    bySupplier[key].count += 1;
  }

  return res.json({ success: true, data: { summary, bySupplier: Object.values(bySupplier), purchases } });
}

/** INVENTORY REPORT — current stock levels, valuation, and low-stock flags per (product, shop). */
export async function inventoryReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["purchase_price"]);
  const { shopId } = resolveShopScope(req);
  const where: any = { owner_id: req.auth!.ownerId };
  if (shopId) where.shop_id = shopId;

  const stocks = await ProductStock.findAll({
    where,
    include: [
      { model: Product, as: "product", attributes: ["id", "name", "sku", "purchase_price", "selling_price", "min_stock"] },
      { model: Shop, as: "shop", attributes: ["id", "name"] },
    ],
    order: [["current_stock", "ASC"]],
  });

  let totalUnits = 0;
  let totalCostValue = 0;
  let totalSellValue = 0;
  let lowStockCount = 0;

  const lines = stocks.map((s: any) => {
    const minStock = s.min_stock ?? s.product?.min_stock ?? 0;
    const isLow = s.current_stock <= minStock;
    if (isLow) lowStockCount += 1;
    totalUnits += s.current_stock;
    totalCostValue = round2(totalCostValue + s.current_stock * Number(s.product?.purchase_price ?? 0));
    totalSellValue = round2(totalSellValue + s.current_stock * Number(s.product?.selling_price ?? 0));

    const productJson = s.product?.toJSON ? s.product.toJSON() : s.product;
    if (productJson && !allowed.purchase_price) delete productJson.purchase_price;

    const line: Record<string, any> = {
      product: productJson,
      shop: s.shop,
      currentStock: s.current_stock,
      minStock,
      isLowStock: isLow,
      sellValue: round2(s.current_stock * Number(s.product?.selling_price ?? 0)),
    };
    if (allowed.purchase_price) {
      line.costValue = round2(s.current_stock * Number(s.product?.purchase_price ?? 0));
    }
    return line;
  });

  return res.json({
    success: true,
    data: {
      summary: allowed.purchase_price
        ? { totalUnits, totalCostValue, totalSellValue, lowStockCount }
        : { totalUnits, totalSellValue, lowStockCount },
      lines,
    },
  });
}

/**
 * PROFIT REPORT — revenue vs. cost-of-goods-sold for sold line items
 * within the period, net of returns. COGS uses each product's
 * CURRENT purchase_price (see purchaseReport's note — no historical
 * cost snapshot per sale line exists yet), so this is a good
 * approximation, not a precise historical P&L.
 */
export async function profitReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["profit"]);
  if (!allowed.profit) {
    return res.status(403).json({ success: false, message: "You do not have permission to view profit data" });
  }

  const { shopId } = resolveShopScope(req);
  const saleWhere: any = { owner_id: req.auth!.ownerId, status: { [Op.ne]: "cancelled" } };
  if (shopId) saleWhere.shop_id = shopId;
  Object.assign(saleWhere, dateRangeWhere("invoice_date", req) ?? {});

  const sales = await Sale.findAll({
    where: saleWhere,
    include: [{ model: SaleItem, as: "items", include: [{ model: Product, as: "product", attributes: ["id", "purchase_price"] }] }],
  });

  let revenue = 0;
  let cogs = 0;
  const byProduct: Record<string, { productId: number; name: string; revenue: number; cogs: number; profit: number }> = {};

  for (const sale of sales) {
    for (const item of (sale as any).items as any[]) {
      const soldQty = item.quantity - item.returned_quantity;
      if (soldQty <= 0) continue;
      const unitRevenue = Number(item.total_amount) / item.quantity;
      const lineRevenue = round2(unitRevenue * soldQty);
      const unitCost = Number(item.product?.purchase_price ?? 0);
      const lineCogs = round2(unitCost * soldQty);

      revenue = round2(revenue + lineRevenue);
      cogs = round2(cogs + lineCogs);

      const key = String(item.product_id);
      if (!byProduct[key]) byProduct[key] = { productId: item.product_id, name: item.product_name, revenue: 0, cogs: 0, profit: 0 };
      byProduct[key].revenue = round2(byProduct[key].revenue + lineRevenue);
      byProduct[key].cogs = round2(byProduct[key].cogs + lineCogs);
      byProduct[key].profit = round2(byProduct[key].revenue - byProduct[key].cogs);
    }
  }

  const grossProfit = round2(revenue - cogs);
  const marginPercent = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;

  return res.json({
    success: true,
    data: {
      summary: { revenue, cogs, grossProfit, marginPercent },
      byProduct: Object.values(byProduct).sort((a, b) => b.profit - a.profit),
    },
  });
}

/**
 * CUSTOMER OUTSTANDING REPORT — Customers are an owner-level entity
 * (a customer can transact across multiple shops of the same owner —
 * see models/Customer.ts), so `current_balance` is a global figure.
 * For the Owner that's exactly right. For an employee pinned to one
 * shop, showing the GLOBAL balance would leak what a customer owes
 * across OTHER shops too — a shop-isolation leak — so employees
 * instead get a balance recomputed from just THAT shop's ledger
 * entries.
 */
export async function customerOutstandingReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["customer_outstanding"]);
  if (!allowed.customer_outstanding) {
    return res.status(403).json({ success: false, message: "You do not have permission to view customer outstanding balances" });
  }

  if (req.auth!.isOwner) {
    const customers = await Customer.findAll({ where: { owner_id: req.auth!.ownerId }, order: [["current_balance", "DESC"]] });
    const outstanding = customers.filter((c) => Number(c.current_balance) !== 0);
    const totalReceivable = round2(outstanding.filter((c) => Number(c.current_balance) > 0).reduce((s, c) => s + Number(c.current_balance), 0));
    const totalCredit = round2(outstanding.filter((c) => Number(c.current_balance) < 0).reduce((s, c) => s + Number(c.current_balance), 0));
    return res.json({ success: true, data: { summary: { totalReceivable, totalCredit, customerCount: outstanding.length }, customers: outstanding } });
  }

  const entries = await CustomerLedger.findAll({
    where: { owner_id: req.auth!.ownerId, shop_id: req.auth!.shopId!, status: "active" },
    include: [{ model: Customer, as: "customer", attributes: ["id", "name", "phone"] }],
  });

  const byCustomer: Record<string, { customer: any; balance: number }> = {};
  for (const e of entries as any[]) {
    const key = String(e.customer_id);
    if (!byCustomer[key]) byCustomer[key] = { customer: e.customer, balance: 0 };
    byCustomer[key].balance = round2(byCustomer[key].balance + (e.entry_type === "debit" ? Number(e.amount) : -Number(e.amount)));
  }
  const customers = Object.values(byCustomer).filter((c) => c.balance !== 0);
  const totalReceivable = round2(customers.filter((c) => c.balance > 0).reduce((s, c) => s + c.balance, 0));
  const totalCredit = round2(customers.filter((c) => c.balance < 0).reduce((s, c) => s + c.balance, 0));

  return res.json({
    success: true,
    data: {
      note: "Balance shown is scoped to this shop's transactions only (you're not an owner, so cross-shop balances are hidden).",
      summary: { totalReceivable, totalCredit, customerCount: customers.length },
      customers,
    },
  });
}

/**
 * SUPPLIER OUTSTANDING REPORT — best-effort from purchase volume,
 * since this codebase has no Purchase Order / Supplier Payment /
 * Supplier Ledger module yet (see Supplier.ts). Returns purchase
 * VALUE per supplier for the period, clearly labeled as such rather
 * than a true payable balance — wire this up to a real
 * `outstanding_amount` once a SupplierPayment model exists.
 */
/** SUPPLIER OUTSTANDING REPORT — real payable balances from Supplier.current_balance / SupplierLedger now that the Purchase module exists. */
export async function supplierOutstandingReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["purchase_price"]);
  if (!allowed.purchase_price) {
    return res.status(403).json({ success: false, message: "You do not have permission to view purchase/supplier cost data" });
  }

  if (req.auth!.isOwner) {
    const suppliers = await Supplier.findAll({ where: { owner_id: req.auth!.ownerId }, order: [["current_balance", "DESC"]] });
    const outstanding = suppliers.filter((s) => Number(s.current_balance) !== 0);
    const totalPayable = round2(outstanding.reduce((sum, s) => sum + Number(s.current_balance), 0));
    return res.json({ success: true, data: { summary: { totalPayable, supplierCount: outstanding.length }, suppliers: outstanding } });
  }

  // Employees see a balance recomputed from just their own shop's ledger entries (same shop-isolation
  // rationale as customerOutstandingReport — Supplier.current_balance is owner-wide across all shops).
  const entries = await SupplierLedger.findAll({
    where: { owner_id: req.auth!.ownerId, shop_id: req.auth!.shopId!, status: "active" },
    include: [{ model: Supplier, as: "supplier", attributes: ["id", "name", "phone"] }],
  });

  const bySupplier: Record<string, { supplier: any; balance: number }> = {};
  for (const e of entries as any[]) {
    const key = String(e.supplier_id);
    if (!bySupplier[key]) bySupplier[key] = { supplier: e.supplier, balance: 0 };
    bySupplier[key].balance = round2(bySupplier[key].balance + (e.entry_type === "credit" ? Number(e.amount) : -Number(e.amount)));
  }
  const suppliers = Object.values(bySupplier).filter((s) => s.balance !== 0);
  const totalPayable = round2(suppliers.reduce((sum, s) => sum + s.balance, 0));

  return res.json({
    success: true,
    data: {
      note: "Balance shown is scoped to this shop's purchases only (you're not an owner, so cross-shop balances are hidden).",
      summary: { totalPayable, supplierCount: suppliers.length },
      suppliers,
    },
  });
}

/** EMI REPORT — active/completed/cancelled plans, outstanding totals, and installment status mix. */
export async function emiReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["emi"]);
  if (!allowed.emi) {
    return res.status(403).json({ success: false, message: "You do not have permission to view EMI data" });
  }

  const { shopId } = resolveShopScope(req);
  const where: any = { owner_id: req.auth!.ownerId };
  if (shopId) where.shop_id = shopId;

  const plans = await EMIPlan.findAll({
    where,
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "phone"] },
      { model: Sale, as: "sale", attributes: ["id", "invoice_number"] },
      { model: EMIInstallment, as: "installments" },
    ],
  });

  const summary = plans.reduce(
    (acc, p) => {
      acc.totalPlans += 1;
      acc.byStatus[p.status] = (acc.byStatus[p.status] || 0) + 1;
      acc.totalFinanced = round2(acc.totalFinanced + Number(p.financed_amount));
      acc.totalOutstanding = round2(acc.totalOutstanding + Number(p.outstanding_amount));
      return acc;
    },
    { totalPlans: 0, totalFinanced: 0, totalOutstanding: 0, byStatus: {} as Record<string, number> }
  );

  const installmentStatusMix: Record<string, number> = {};
  for (const p of plans) {
    for (const inst of (p as any).installments as any[]) {
      installmentStatusMix[inst.status] = (installmentStatusMix[inst.status] || 0) + 1;
    }
  }

  return res.json({ success: true, data: { summary, installmentStatusMix, plans } });
}

/** PAYMENTS REPORT — every payment received in the period, broken down by method and type. */
export async function paymentsReport(req: Request, res: Response) {
  const { shopId } = resolveShopScope(req);
  const where: any = { owner_id: req.auth!.ownerId, status: "completed" };
  if (shopId) where.shop_id = shopId;
  Object.assign(where, dateRangeWhere("payment_date", req) ?? {});

  const payments = await Payment.findAll({
    where,
    include: [{ model: Customer, as: "customer", attributes: ["id", "name"] }],
    order: [["payment_date", "DESC"]],
  });

  const byMethod: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let total = 0;
  for (const p of payments) {
    byMethod[p.method] = round2((byMethod[p.method] || 0) + Number(p.amount));
    byType[p.type] = round2((byType[p.type] || 0) + Number(p.amount));
    total = round2(total + Number(p.amount));
  }

  return res.json({ success: true, data: { summary: { total, count: payments.length, byMethod, byType }, payments } });
}

/** SHOP PERFORMANCE REPORT — owner sees all shops side by side; an employee only ever sees their own current shop (shop isolation). */
export async function shopPerformanceReport(req: Request, res: Response) {
  const shopWhere: any = { owner_id: req.auth!.ownerId };
  if (!req.auth!.isOwner) shopWhere.id = req.auth!.shopId;

  const shops = await Shop.findAll({ where: shopWhere });
  const saleDateWhere = dateRangeWhere("invoice_date", req) ?? {};

  const rows = await Promise.all(
    shops.map(async (shop) => {
      const sales = await Sale.findAll({
        where: { owner_id: req.auth!.ownerId, shop_id: shop.id, status: { [Op.ne]: "cancelled" }, ...saleDateWhere },
      });
      const revenue = round2(sales.reduce((s, x) => s + Number(x.total_amount), 0));
      const due = round2(sales.reduce((s, x) => s + Number(x.due_amount), 0));
      return { shop: { id: shop.id, name: shop.name, code: shop.code }, salesCount: sales.length, revenue, due };
    })
  );

  rows.sort((a, b) => b.revenue - a.revenue);
  return res.json({ success: true, data: { shops: rows } });
}

/** PRODUCT PERFORMANCE REPORT — units sold and revenue per product for the period. */
export async function productPerformanceReport(req: Request, res: Response) {
  const { shopId } = resolveShopScope(req);
  const saleWhere: any = { owner_id: req.auth!.ownerId, status: { [Op.ne]: "cancelled" } };
  if (shopId) saleWhere.shop_id = shopId;
  Object.assign(saleWhere, dateRangeWhere("invoice_date", req) ?? {});

  const sales = await Sale.findAll({ where: saleWhere, include: [{ model: SaleItem, as: "items" }] });

  const byProduct: Record<string, { productId: number; name: string; sku: string; unitsSold: number; revenue: number }> = {};
  for (const sale of sales) {
    for (const item of (sale as any).items as any[]) {
      const soldQty = item.quantity - item.returned_quantity;
      if (soldQty <= 0) continue;
      const key = String(item.product_id);
      if (!byProduct[key]) byProduct[key] = { productId: item.product_id, name: item.product_name, sku: item.sku, unitsSold: 0, revenue: 0 };
      byProduct[key].unitsSold += soldQty;
      byProduct[key].revenue = round2(byProduct[key].revenue + (Number(item.total_amount) / item.quantity) * soldQty);
    }
  }

  const products = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue);
  return res.json({ success: true, data: { products } });
}

/** EMPLOYEE ATTENDANCE REPORT — per-employee status counts for the period. Owner sees all employees; an employee-actor only sees staff assigned to their own shop. */
export async function attendanceReport(req: Request, res: Response) {
  const { shopId } = resolveShopScope(req);
  const where: any = { owner_id: req.auth!.ownerId };
  if (shopId) where.shop_id = shopId;
  if (req.query.employeeId) where.employee_id = req.query.employeeId;
  const visibleEmployeeIds = await getVisibleEmployeeIds(req);
  if (visibleEmployeeIds) where.employee_id = where.employee_id ? where.employee_id : { [Op.in]: visibleEmployeeIds };
  Object.assign(where, dateOnlyRangeWhere("date", req) ?? {});

  const records = await Attendance.findAll({
    where,
    include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }],
    order: [["date", "DESC"]],
  });

  const byEmployee: Record<string, { employeeId: number; name: string; counts: Record<string, number>; totalOvertimeHours: number }> = {};
  for (const r of records as any[]) {
    const key = String(r.employee_id);
    if (!byEmployee[key]) byEmployee[key] = { employeeId: r.employee_id, name: r.employee?.name, counts: {}, totalOvertimeHours: 0 };
    byEmployee[key].counts[r.status] = (byEmployee[key].counts[r.status] || 0) + 1;
    byEmployee[key].totalOvertimeHours = round2(byEmployee[key].totalOvertimeHours + Number(r.overtime_hours));
  }

  return res.json({ success: true, data: { employees: Object.values(byEmployee), records } });
}

/** EMPLOYEE SALARY REPORT — active salary structures + total salary paid in the period, per employee. */
export async function salaryReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["salary"]);
  if (!allowed.salary) {
    return res.status(403).json({ success: false, message: "You do not have permission to view salary data" });
  }

  const { shopId } = resolveShopScope(req);
  const visibleEmployeeIds = await getVisibleEmployeeIds(req);
  const employeeWhere: any = { owner_id: req.auth!.ownerId };
  if (visibleEmployeeIds) employeeWhere.id = { [Op.in]: visibleEmployeeIds };
  const employees = await Employee.findAll({ where: employeeWhere });

  const paymentWhere: any = { owner_id: req.auth!.ownerId, status: "completed" };
  if (shopId) paymentWhere.shop_id = shopId;
  if (visibleEmployeeIds) paymentWhere.employee_id = { [Op.in]: visibleEmployeeIds };
  Object.assign(paymentWhere, dateRangeWhere("payment_date", req) ?? {});
  const payments = await SalaryPayment.findAll({ where: paymentWhere });

  const paidByEmployee: Record<string, number> = {};
  for (const p of payments) {
    paidByEmployee[p.employee_id] = round2((paidByEmployee[p.employee_id] || 0) + Number(p.amount));
  }

  const rows = employees.map((e) => ({
    employeeId: e.id,
    name: e.name,
    salaryOutstanding: Number(e.salary_outstanding),
    paidInPeriod: paidByEmployee[e.id] || 0,
  }));

  return res.json({
    success: true,
    data: { totalPaidInPeriod: round2(Object.values(paidByEmployee).reduce((s, v) => s + v, 0)), employees: rows },
  });
}

/** PAYROLL REPORT — payroll runs in the period with gross/net/paid/due breakdown, per employee and totals. */
export async function payrollReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["salary"]);
  if (!allowed.salary) {
    return res.status(403).json({ success: false, message: "You do not have permission to view payroll data" });
  }

  const { shopId } = resolveShopScope(req);
  const visibleEmployeeIds = await getVisibleEmployeeIds(req);
  const where: any = { owner_id: req.auth!.ownerId };
  if (shopId) where.shop_id = shopId;
  if (req.query.employeeId) where.employee_id = req.query.employeeId;
  else if (visibleEmployeeIds) where.employee_id = { [Op.in]: visibleEmployeeIds };
  Object.assign(where, dateOnlyRangeWhere("period_start", req) ?? {});

  const payrolls = await Payroll.findAll({
    where,
    include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }],
    order: [["period_start", "DESC"]],
  });

  const summary = payrolls.reduce(
    (acc, p) => {
      if (p.status === "cancelled") return acc;
      acc.grossTotal = round2(acc.grossTotal + Number(p.gross_salary));
      acc.netTotal = round2(acc.netTotal + Number(p.net_salary));
      acc.paidTotal = round2(acc.paidTotal + Number(p.paid_amount));
      acc.dueTotal = round2(acc.dueTotal + Number(p.due_amount));
      return acc;
    },
    { grossTotal: 0, netTotal: 0, paidTotal: 0, dueTotal: 0 }
  );

  return res.json({ success: true, data: { summary, payrolls } });
}

/** EMPLOYEE ADVANCE REPORT — advances disbursed/recovered/outstanding in the period, per employee and totals. */
export async function advanceReport(req: Request, res: Response) {
  const allowed = await getAllowedFields(req, ["salary"]);
  if (!allowed.salary) {
    return res.status(403).json({ success: false, message: "You do not have permission to view advance data" });
  }

  const { shopId } = resolveShopScope(req);
  const visibleEmployeeIds = await getVisibleEmployeeIds(req);
  const where: any = { owner_id: req.auth!.ownerId };
  if (shopId) where.shop_id = shopId;
  if (req.query.employeeId) where.employee_id = req.query.employeeId;
  else if (visibleEmployeeIds) where.employee_id = { [Op.in]: visibleEmployeeIds };
  Object.assign(where, dateRangeWhere("date", req) ?? {});

  const advances = await EmployeeAdvance.findAll({
    where,
    include: [{ model: Employee, as: "employee", attributes: ["id", "name"] }],
    order: [["date", "DESC"]],
  });

  const summary = advances.reduce(
    (acc, a) => {
      if (a.status === "cancelled") return acc;
      acc.totalDisbursed = round2(acc.totalDisbursed + Number(a.amount));
      acc.totalOutstanding = round2(acc.totalOutstanding + Number(a.outstanding_amount));
      acc.totalRecovered = round2(acc.totalRecovered + (Number(a.amount) - Number(a.outstanding_amount)));
      return acc;
    },
    { totalDisbursed: 0, totalOutstanding: 0, totalRecovered: 0 }
  );

  return res.json({ success: true, data: { summary, advances } });
}
