"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDemoData = resetDemoData;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const seedData_1 = require("./seedData");
function log(msg) {
    console.log(`[DEMO RESET] ${msg}`);
}
/**
 * Deletes ONLY rows that belong to the demo owner (matched by
 * DEMO_MARKER_EMAIL) — every query below is scoped by that owner's id
 * (or a join derived from it), so this can never touch a real
 * owner's data. Deletes children before parents to respect FKs, all
 * inside one transaction so a failure midway leaves nothing half-deleted.
 */
async function resetDemoData() {
    const owner = await models_1.Owner.findOne({ where: { email: seedData_1.DEMO_MARKER_EMAIL } });
    if (!owner) {
        log("No demo owner found — nothing to reset.");
        return;
    }
    const ownerId = owner.id;
    await models_1.sequelize.transaction(async (t) => {
        const employees = await models_1.Employee.findAll({ where: { owner_id: ownerId }, transaction: t });
        const employeeIds = employees.map((e) => e.id);
        const emiPlans = await models_1.EMIPlan.findAll({ where: { owner_id: ownerId }, transaction: t });
        const emiPlanIds = emiPlans.map((p) => p.id);
        const sales = await models_1.Sale.findAll({ where: { owner_id: ownerId }, transaction: t });
        const saleIds = sales.map((s) => s.id);
        const saleReturns = await models_1.SaleReturn.findAll({ where: { owner_id: ownerId }, transaction: t });
        const saleReturnIds = saleReturns.map((r) => r.id);
        const purchases = await models_1.Purchase.findAll({ where: { owner_id: ownerId }, transaction: t });
        const purchaseIds = purchases.map((p) => p.id);
        const purchaseReturns = await models_1.PurchaseReturn.findAll({ where: { owner_id: ownerId }, transaction: t });
        const purchaseReturnIds = purchaseReturns.map((r) => r.id);
        const roles = await models_1.Role.findAll({ where: { owner_id: ownerId }, transaction: t });
        const roleIds = roles.map((r) => r.id);
        const products = await models_1.Product.findAll({ where: { owner_id: ownerId }, transaction: t });
        const productIds = products.map((p) => p.id);
        // Notifications / audit / financial ledgers / people-ops (all have owner_id directly)
        await models_1.Notification.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.AuditLog.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.SalaryPayment.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Payroll.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.EmployeeIncentive.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.EmployeeAdvance.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.SalaryConfig.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.EmployeeLedger.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.LeaveRequest.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Attendance.destroy({ where: { owner_id: ownerId }, transaction: t });
        // EMI (installments have no owner_id — go via plan ids)
        if (emiPlanIds.length)
            await models_1.EMIInstallment.destroy({ where: { emi_plan_id: { [sequelize_1.Op.in]: emiPlanIds } }, transaction: t });
        await models_1.EMIPlan.destroy({ where: { owner_id: ownerId }, transaction: t });
        // Sales
        if (saleReturnIds.length)
            await models_1.SaleReturnItem.destroy({ where: { sale_return_id: { [sequelize_1.Op.in]: saleReturnIds } }, transaction: t });
        await models_1.SaleReturn.destroy({ where: { owner_id: ownerId }, transaction: t });
        if (saleIds.length)
            await models_1.SaleItem.destroy({ where: { sale_id: { [sequelize_1.Op.in]: saleIds } }, transaction: t });
        await models_1.Payment.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Sale.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.CustomerLedger.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.InvoiceCounter.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Customer.destroy({ where: { owner_id: ownerId }, transaction: t });
        // Purchases
        if (purchaseReturnIds.length)
            await models_1.PurchaseReturnItem.destroy({ where: { purchase_return_id: { [sequelize_1.Op.in]: purchaseReturnIds } }, transaction: t });
        await models_1.PurchaseReturn.destroy({ where: { owner_id: ownerId }, transaction: t });
        if (purchaseIds.length)
            await models_1.PurchaseItem.destroy({ where: { purchase_id: { [sequelize_1.Op.in]: purchaseIds } }, transaction: t });
        await models_1.SupplierPayment.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Purchase.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.SupplierLedger.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.PurchaseCounter.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Supplier.destroy({ where: { owner_id: ownerId }, transaction: t });
        // Inventory / products
        await models_1.InventoryTransaction.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.StockTransfer.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.ProductStock.destroy({ where: { owner_id: ownerId }, transaction: t });
        if (productIds.length) {
            await models_1.ProductImage.destroy({ where: { product_id: { [sequelize_1.Op.in]: productIds } }, transaction: t });
            await models_1.ProductLocation.destroy({ where: { product_id: { [sequelize_1.Op.in]: productIds } }, transaction: t });
        }
        await models_1.Product.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Subcategory.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Category.destroy({ where: { owner_id: ownerId }, transaction: t });
        // People / auth / roles
        if (employeeIds.length) {
            await models_1.EmployeeShop.destroy({ where: { employee_id: { [sequelize_1.Op.in]: employeeIds } }, transaction: t });
            await models_1.RefreshToken.destroy({ where: { employee_id: { [sequelize_1.Op.in]: employeeIds } }, transaction: t });
        }
        await models_1.RefreshToken.destroy({ where: { owner_id: ownerId }, transaction: t });
        if (roleIds.length) {
            await models_1.RolePermission.destroy({ where: { role_id: { [sequelize_1.Op.in]: roleIds } }, transaction: t });
            await models_1.RoleFieldPermission.destroy({ where: { role_id: { [sequelize_1.Op.in]: roleIds } }, transaction: t });
        }
        await models_1.Role.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Employee.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Shop.destroy({ where: { owner_id: ownerId }, transaction: t });
        await models_1.Owner.destroy({ where: { id: ownerId }, transaction: t });
    });
    log(`Demo owner (id ${ownerId}) and all related demo data removed.`);
}
if (require.main === module) {
    if (process.env.NODE_ENV === "production") {
        console.error("[DEMO RESET] Refusing to run: NODE_ENV=production");
        process.exit(1);
    }
    models_1.sequelize
        .authenticate()
        .then(resetDemoData)
        .then(() => models_1.sequelize.close())
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=reset.js.map