import dotenv from "dotenv";
dotenv.config();

import { Op } from "sequelize";
import {
  sequelize,
  Owner,
  Shop,
  Employee,
  EmployeeShop,
  Role,
  RolePermission,
  RoleFieldPermission,
  RefreshToken,
  AuditLog,
  Product,
  ProductImage,
  ProductLocation,
  ProductStock,
  InventoryTransaction,
  StockTransfer,
  Category,
  Subcategory,
  Supplier,
  Customer,
  CustomerLedger,
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  Payment,
  EMIPlan,
  EMIInstallment,
  InvoiceCounter,
  Purchase,
  PurchaseItem,
  PurchaseReturn,
  PurchaseReturnItem,
  PurchaseCounter,
  SupplierPayment,
  SupplierLedger,
  Attendance,
  LeaveRequest,
  SalaryConfig,
  EmployeeAdvance,
  EmployeeIncentive,
  Payroll,
  SalaryPayment,
  EmployeeLedger,
  Notification,
} from "../models";
import { DEMO_MARKER_EMAIL } from "./seedData";

function log(msg: string) {
  console.log(`[DEMO RESET] ${msg}`);
}

/**
 * Deletes ONLY rows that belong to the demo owner (matched by
 * DEMO_MARKER_EMAIL) — every query below is scoped by that owner's id
 * (or a join derived from it), so this can never touch a real
 * owner's data. Deletes children before parents to respect FKs, all
 * inside one transaction so a failure midway leaves nothing half-deleted.
 */
export async function resetDemoData(): Promise<void> {
  const owner = await Owner.findOne({ where: { email: DEMO_MARKER_EMAIL } });
  if (!owner) {
    log("No demo owner found — nothing to reset.");
    return;
  }
  const ownerId = owner.id;

  await sequelize.transaction(async (t) => {
    const employees = await Employee.findAll({ where: { owner_id: ownerId }, transaction: t });
    const employeeIds = employees.map((e) => e.id);

    const emiPlans = await EMIPlan.findAll({ where: { owner_id: ownerId }, transaction: t });
    const emiPlanIds = emiPlans.map((p) => p.id);

    const sales = await Sale.findAll({ where: { owner_id: ownerId }, transaction: t });
    const saleIds = sales.map((s) => s.id);
    const saleReturns = await SaleReturn.findAll({ where: { owner_id: ownerId }, transaction: t });
    const saleReturnIds = saleReturns.map((r) => r.id);

    const purchases = await Purchase.findAll({ where: { owner_id: ownerId }, transaction: t });
    const purchaseIds = purchases.map((p) => p.id);
    const purchaseReturns = await PurchaseReturn.findAll({ where: { owner_id: ownerId }, transaction: t });
    const purchaseReturnIds = purchaseReturns.map((r) => r.id);

    const roles = await Role.findAll({ where: { owner_id: ownerId }, transaction: t });
    const roleIds = roles.map((r) => r.id);

    const products = await Product.findAll({ where: { owner_id: ownerId }, transaction: t });
    const productIds = products.map((p) => p.id);

    // Notifications / audit / financial ledgers / people-ops (all have owner_id directly)
    await Notification.destroy({ where: { owner_id: ownerId }, transaction: t });
    await AuditLog.destroy({ where: { owner_id: ownerId }, transaction: t });

    await SalaryPayment.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Payroll.destroy({ where: { owner_id: ownerId }, transaction: t });
    await EmployeeIncentive.destroy({ where: { owner_id: ownerId }, transaction: t });
    await EmployeeAdvance.destroy({ where: { owner_id: ownerId }, transaction: t });
    await SalaryConfig.destroy({ where: { owner_id: ownerId }, transaction: t });
    await EmployeeLedger.destroy({ where: { owner_id: ownerId }, transaction: t });
    await LeaveRequest.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Attendance.destroy({ where: { owner_id: ownerId }, transaction: t });

    // EMI (installments have no owner_id — go via plan ids)
    if (emiPlanIds.length) await EMIInstallment.destroy({ where: { emi_plan_id: { [Op.in]: emiPlanIds } }, transaction: t });
    await EMIPlan.destroy({ where: { owner_id: ownerId }, transaction: t });

    // Sales
    if (saleReturnIds.length) await SaleReturnItem.destroy({ where: { sale_return_id: { [Op.in]: saleReturnIds } }, transaction: t });
    await SaleReturn.destroy({ where: { owner_id: ownerId }, transaction: t });
    if (saleIds.length) await SaleItem.destroy({ where: { sale_id: { [Op.in]: saleIds } }, transaction: t });
    await Payment.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Sale.destroy({ where: { owner_id: ownerId }, transaction: t });
    await CustomerLedger.destroy({ where: { owner_id: ownerId }, transaction: t });
    await InvoiceCounter.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Customer.destroy({ where: { owner_id: ownerId }, transaction: t });

    // Purchases
    if (purchaseReturnIds.length) await PurchaseReturnItem.destroy({ where: { purchase_return_id: { [Op.in]: purchaseReturnIds } }, transaction: t });
    await PurchaseReturn.destroy({ where: { owner_id: ownerId }, transaction: t });
    if (purchaseIds.length) await PurchaseItem.destroy({ where: { purchase_id: { [Op.in]: purchaseIds } }, transaction: t });
    await SupplierPayment.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Purchase.destroy({ where: { owner_id: ownerId }, transaction: t });
    await SupplierLedger.destroy({ where: { owner_id: ownerId }, transaction: t });
    await PurchaseCounter.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Supplier.destroy({ where: { owner_id: ownerId }, transaction: t });

    // Inventory / products
    await InventoryTransaction.destroy({ where: { owner_id: ownerId }, transaction: t });
    await StockTransfer.destroy({ where: { owner_id: ownerId }, transaction: t });
    await ProductStock.destroy({ where: { owner_id: ownerId }, transaction: t });
    if (productIds.length) {
      await ProductImage.destroy({ where: { product_id: { [Op.in]: productIds } }, transaction: t });
      await ProductLocation.destroy({ where: { product_id: { [Op.in]: productIds } }, transaction: t });
    }
    await Product.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Subcategory.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Category.destroy({ where: { owner_id: ownerId }, transaction: t });

    // People / auth / roles
    if (employeeIds.length) {
      await EmployeeShop.destroy({ where: { employee_id: { [Op.in]: employeeIds } }, transaction: t });
      await RefreshToken.destroy({ where: { employee_id: { [Op.in]: employeeIds } }, transaction: t });
    }
    await RefreshToken.destroy({ where: { owner_id: ownerId }, transaction: t });
    if (roleIds.length) {
      await RolePermission.destroy({ where: { role_id: { [Op.in]: roleIds } }, transaction: t });
      await RoleFieldPermission.destroy({ where: { role_id: { [Op.in]: roleIds } }, transaction: t });
    }
    await Role.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Employee.destroy({ where: { owner_id: ownerId }, transaction: t });
    await Shop.destroy({ where: { owner_id: ownerId }, transaction: t });

    await Owner.destroy({ where: { id: ownerId }, transaction: t });
  });

  log(`Demo owner (id ${ownerId}) and all related demo data removed.`);
}

if (require.main === module) {
  if (process.env.NODE_ENV === "production") {
    console.error("[DEMO RESET] Refusing to run: NODE_ENV=production");
    process.exit(1);
  }
  sequelize
    .authenticate()
    .then(resetDemoData)
    .then(() => sequelize.close())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
