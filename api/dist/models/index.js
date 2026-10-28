"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VISIBILITY_SETTINGS = exports.VisibilitySettings = exports.OrderItem = exports.Order = exports.PurchaseReturnItem = exports.PurchaseReturn = exports.SupplierLedger = exports.SupplierPayment = exports.PurchaseItem = exports.Purchase = exports.PurchaseCounter = exports.Notification = exports.EmployeeLedger = exports.SalaryPayment = exports.Payroll = exports.EmployeeIncentive = exports.EmployeeAdvance = exports.SalaryConfig = exports.LeaveRequest = exports.Attendance = exports.InvoiceCounter = exports.SaleReturnItem = exports.SaleReturn = exports.EMIInstallment = exports.EMIPlan = exports.CustomerLedger = exports.Payment = exports.SaleItem = exports.Sale = exports.Customer = exports.StockTransfer = exports.InventoryTransaction = exports.ProductLocation = exports.ProductStock = exports.ProductImage = exports.Supplier = exports.Subcategory = exports.Category = exports.Product = exports.AuditLog = exports.RefreshToken = exports.EmployeeShop = exports.Employee = exports.RoleFieldPermission = exports.RolePermission = exports.Role = exports.Shop = exports.Owner = exports.sequelize = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.sequelize = database_1.default;
const Owner_1 = require("./Owner");
Object.defineProperty(exports, "Owner", { enumerable: true, get: function () { return Owner_1.Owner; } });
const Shop_1 = require("./Shop");
Object.defineProperty(exports, "Shop", { enumerable: true, get: function () { return Shop_1.Shop; } });
const Role_1 = require("./Role");
Object.defineProperty(exports, "Role", { enumerable: true, get: function () { return Role_1.Role; } });
const RolePermission_1 = require("./RolePermission");
Object.defineProperty(exports, "RolePermission", { enumerable: true, get: function () { return RolePermission_1.RolePermission; } });
const RoleFieldPermission_1 = require("./RoleFieldPermission");
Object.defineProperty(exports, "RoleFieldPermission", { enumerable: true, get: function () { return RoleFieldPermission_1.RoleFieldPermission; } });
const Employee_1 = require("./Employee");
Object.defineProperty(exports, "Employee", { enumerable: true, get: function () { return Employee_1.Employee; } });
const EmployeeShop_1 = require("./EmployeeShop");
Object.defineProperty(exports, "EmployeeShop", { enumerable: true, get: function () { return EmployeeShop_1.EmployeeShop; } });
const RefreshToken_1 = require("./RefreshToken");
Object.defineProperty(exports, "RefreshToken", { enumerable: true, get: function () { return RefreshToken_1.RefreshToken; } });
const AuditLog_1 = require("./AuditLog");
Object.defineProperty(exports, "AuditLog", { enumerable: true, get: function () { return AuditLog_1.AuditLog; } });
const Product_1 = require("./Product");
Object.defineProperty(exports, "Product", { enumerable: true, get: function () { return Product_1.Product; } });
const Category_1 = require("./Category");
Object.defineProperty(exports, "Category", { enumerable: true, get: function () { return Category_1.Category; } });
const Subcategory_1 = require("./Subcategory");
Object.defineProperty(exports, "Subcategory", { enumerable: true, get: function () { return Subcategory_1.Subcategory; } });
const Supplier_1 = require("./Supplier");
Object.defineProperty(exports, "Supplier", { enumerable: true, get: function () { return Supplier_1.Supplier; } });
const ProductImage_1 = require("./ProductImage");
Object.defineProperty(exports, "ProductImage", { enumerable: true, get: function () { return ProductImage_1.ProductImage; } });
const ProductStock_1 = require("./ProductStock");
Object.defineProperty(exports, "ProductStock", { enumerable: true, get: function () { return ProductStock_1.ProductStock; } });
const ProductLocation_1 = require("./ProductLocation");
Object.defineProperty(exports, "ProductLocation", { enumerable: true, get: function () { return ProductLocation_1.ProductLocation; } });
const InventoryTransaction_1 = require("./InventoryTransaction");
Object.defineProperty(exports, "InventoryTransaction", { enumerable: true, get: function () { return InventoryTransaction_1.InventoryTransaction; } });
const StockTransfer_1 = require("./StockTransfer");
Object.defineProperty(exports, "StockTransfer", { enumerable: true, get: function () { return StockTransfer_1.StockTransfer; } });
const Customer_1 = require("./Customer");
Object.defineProperty(exports, "Customer", { enumerable: true, get: function () { return Customer_1.Customer; } });
const Sale_1 = require("./Sale");
Object.defineProperty(exports, "Sale", { enumerable: true, get: function () { return Sale_1.Sale; } });
const SaleItem_1 = require("./SaleItem");
Object.defineProperty(exports, "SaleItem", { enumerable: true, get: function () { return SaleItem_1.SaleItem; } });
const Payment_1 = require("./Payment");
Object.defineProperty(exports, "Payment", { enumerable: true, get: function () { return Payment_1.Payment; } });
const CustomerLedger_1 = require("./CustomerLedger");
Object.defineProperty(exports, "CustomerLedger", { enumerable: true, get: function () { return CustomerLedger_1.CustomerLedger; } });
const EMIPlan_1 = require("./EMIPlan");
Object.defineProperty(exports, "EMIPlan", { enumerable: true, get: function () { return EMIPlan_1.EMIPlan; } });
const EMIInstallment_1 = require("./EMIInstallment");
Object.defineProperty(exports, "EMIInstallment", { enumerable: true, get: function () { return EMIInstallment_1.EMIInstallment; } });
const SaleReturn_1 = require("./SaleReturn");
Object.defineProperty(exports, "SaleReturn", { enumerable: true, get: function () { return SaleReturn_1.SaleReturn; } });
Object.defineProperty(exports, "SaleReturnItem", { enumerable: true, get: function () { return SaleReturn_1.SaleReturnItem; } });
const InvoiceCounter_1 = require("./InvoiceCounter");
Object.defineProperty(exports, "InvoiceCounter", { enumerable: true, get: function () { return InvoiceCounter_1.InvoiceCounter; } });
const Attendance_1 = require("./Attendance");
Object.defineProperty(exports, "Attendance", { enumerable: true, get: function () { return Attendance_1.Attendance; } });
const LeaveRequest_1 = require("./LeaveRequest");
Object.defineProperty(exports, "LeaveRequest", { enumerable: true, get: function () { return LeaveRequest_1.LeaveRequest; } });
const SalaryConfig_1 = require("./SalaryConfig");
Object.defineProperty(exports, "SalaryConfig", { enumerable: true, get: function () { return SalaryConfig_1.SalaryConfig; } });
const EmployeeAdvance_1 = require("./EmployeeAdvance");
Object.defineProperty(exports, "EmployeeAdvance", { enumerable: true, get: function () { return EmployeeAdvance_1.EmployeeAdvance; } });
const EmployeeIncentive_1 = require("./EmployeeIncentive");
Object.defineProperty(exports, "EmployeeIncentive", { enumerable: true, get: function () { return EmployeeIncentive_1.EmployeeIncentive; } });
const Payroll_1 = require("./Payroll");
Object.defineProperty(exports, "Payroll", { enumerable: true, get: function () { return Payroll_1.Payroll; } });
const SalaryPayment_1 = require("./SalaryPayment");
Object.defineProperty(exports, "SalaryPayment", { enumerable: true, get: function () { return SalaryPayment_1.SalaryPayment; } });
const EmployeeLedger_1 = require("./EmployeeLedger");
Object.defineProperty(exports, "EmployeeLedger", { enumerable: true, get: function () { return EmployeeLedger_1.EmployeeLedger; } });
const Notification_1 = require("./Notification");
Object.defineProperty(exports, "Notification", { enumerable: true, get: function () { return Notification_1.Notification; } });
const PurchaseCounter_1 = require("./PurchaseCounter");
Object.defineProperty(exports, "PurchaseCounter", { enumerable: true, get: function () { return PurchaseCounter_1.PurchaseCounter; } });
const Purchase_1 = require("./Purchase");
Object.defineProperty(exports, "Purchase", { enumerable: true, get: function () { return Purchase_1.Purchase; } });
const PurchaseItem_1 = require("./PurchaseItem");
Object.defineProperty(exports, "PurchaseItem", { enumerable: true, get: function () { return PurchaseItem_1.PurchaseItem; } });
const SupplierPayment_1 = require("./SupplierPayment");
Object.defineProperty(exports, "SupplierPayment", { enumerable: true, get: function () { return SupplierPayment_1.SupplierPayment; } });
const SupplierLedger_1 = require("./SupplierLedger");
Object.defineProperty(exports, "SupplierLedger", { enumerable: true, get: function () { return SupplierLedger_1.SupplierLedger; } });
const PurchaseReturn_1 = require("./PurchaseReturn");
Object.defineProperty(exports, "PurchaseReturn", { enumerable: true, get: function () { return PurchaseReturn_1.PurchaseReturn; } });
Object.defineProperty(exports, "PurchaseReturnItem", { enumerable: true, get: function () { return PurchaseReturn_1.PurchaseReturnItem; } });
const Order_1 = require("./Order");
Object.defineProperty(exports, "Order", { enumerable: true, get: function () { return Order_1.Order; } });
const OrderItem_1 = require("./OrderItem");
Object.defineProperty(exports, "OrderItem", { enumerable: true, get: function () { return OrderItem_1.OrderItem; } });
const VisibilitySettings_1 = require("./VisibilitySettings");
Object.defineProperty(exports, "VisibilitySettings", { enumerable: true, get: function () { return VisibilitySettings_1.VisibilitySettings; } });
Object.defineProperty(exports, "DEFAULT_VISIBILITY_SETTINGS", { enumerable: true, get: function () { return VisibilitySettings_1.DEFAULT_VISIBILITY_SETTINGS; } });
/* ---------------- Owner ---------------- */
Owner_1.Owner.hasMany(Shop_1.Shop, { foreignKey: "owner_id", as: "shops" });
Shop_1.Shop.belongsTo(Owner_1.Owner, { foreignKey: "owner_id", as: "owner" });
Owner_1.Owner.hasMany(Employee_1.Employee, { foreignKey: "owner_id", as: "employees" });
Employee_1.Employee.belongsTo(Owner_1.Owner, { foreignKey: "owner_id", as: "owner" });
Owner_1.Owner.hasMany(Role_1.Role, { foreignKey: "owner_id", as: "roles" });
Role_1.Role.belongsTo(Owner_1.Owner, { foreignKey: "owner_id", as: "owner" });
/* ---------------- Roles & Permissions ---------------- */
Role_1.Role.hasMany(RolePermission_1.RolePermission, { foreignKey: "role_id", as: "permissions" });
RolePermission_1.RolePermission.belongsTo(Role_1.Role, { foreignKey: "role_id", as: "role" });
Role_1.Role.hasMany(RoleFieldPermission_1.RoleFieldPermission, { foreignKey: "role_id", as: "fieldPermissions" });
RoleFieldPermission_1.RoleFieldPermission.belongsTo(Role_1.Role, { foreignKey: "role_id", as: "role" });
/* ---------------- Employee <-> Shop (many-to-many, role per shop) ---------------- */
Employee_1.Employee.hasMany(EmployeeShop_1.EmployeeShop, { foreignKey: "employee_id", as: "shopAssignments" });
EmployeeShop_1.EmployeeShop.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
Shop_1.Shop.hasMany(EmployeeShop_1.EmployeeShop, { foreignKey: "shop_id", as: "employeeAssignments" });
EmployeeShop_1.EmployeeShop.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
Role_1.Role.hasMany(EmployeeShop_1.EmployeeShop, { foreignKey: "role_id", as: "employeeAssignments" });
EmployeeShop_1.EmployeeShop.belongsTo(Role_1.Role, { foreignKey: "role_id", as: "role" });
/* ---------------- Refresh Tokens ---------------- */
Owner_1.Owner.hasMany(RefreshToken_1.RefreshToken, { foreignKey: "owner_id", as: "refreshTokens" });
Employee_1.Employee.hasMany(RefreshToken_1.RefreshToken, { foreignKey: "employee_id", as: "refreshTokens" });
/* ---------------- Audit Logs ---------------- */
Owner_1.Owner.hasMany(AuditLog_1.AuditLog, { foreignKey: "owner_id", as: "auditLogs" });
Shop_1.Shop.hasMany(AuditLog_1.AuditLog, { foreignKey: "shop_id", as: "auditLogs" });
/* ---------------- Categories ---------------- */
Owner_1.Owner.hasMany(Category_1.Category, { foreignKey: "owner_id", as: "categories" });
Category_1.Category.hasMany(Subcategory_1.Subcategory, { foreignKey: "category_id", as: "subcategories" });
Subcategory_1.Subcategory.belongsTo(Category_1.Category, { foreignKey: "category_id", as: "category" });
/* ---------------- Suppliers ---------------- */
Owner_1.Owner.hasMany(Supplier_1.Supplier, { foreignKey: "owner_id", as: "suppliers" });
/* ---------------- Products (owner-level catalog) ---------------- */
Owner_1.Owner.hasMany(Product_1.Product, { foreignKey: "owner_id", as: "products" });
Product_1.Product.belongsTo(Category_1.Category, { foreignKey: "category_id", as: "category" });
Product_1.Product.belongsTo(Subcategory_1.Subcategory, { foreignKey: "subcategory_id", as: "subcategory" });
Product_1.Product.belongsTo(Supplier_1.Supplier, { foreignKey: "supplier_id", as: "supplier" });
Product_1.Product.hasMany(ProductImage_1.ProductImage, { foreignKey: "product_id", as: "images" });
ProductImage_1.ProductImage.belongsTo(Product_1.Product, { foreignKey: "product_id", as: "product" });
/* ---------------- Per-shop stock ---------------- */
Product_1.Product.hasMany(ProductStock_1.ProductStock, { foreignKey: "product_id", as: "stocks" });
ProductStock_1.ProductStock.belongsTo(Product_1.Product, { foreignKey: "product_id", as: "product" });
Shop_1.Shop.hasMany(ProductStock_1.ProductStock, { foreignKey: "shop_id", as: "productStocks" });
ProductStock_1.ProductStock.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
/* ---------------- Per-shop location history ---------------- */
Product_1.Product.hasMany(ProductLocation_1.ProductLocation, { foreignKey: "product_id", as: "locations" });
ProductLocation_1.ProductLocation.belongsTo(Product_1.Product, { foreignKey: "product_id", as: "product" });
ProductLocation_1.ProductLocation.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
/* ---------------- Inventory ledger ---------------- */
Product_1.Product.hasMany(InventoryTransaction_1.InventoryTransaction, { foreignKey: "product_id", as: "inventoryTransactions" });
InventoryTransaction_1.InventoryTransaction.belongsTo(Product_1.Product, { foreignKey: "product_id", as: "product" });
Shop_1.Shop.hasMany(InventoryTransaction_1.InventoryTransaction, { foreignKey: "shop_id", as: "inventoryTransactions" });
InventoryTransaction_1.InventoryTransaction.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
/* ---------------- Stock transfers ---------------- */
Product_1.Product.hasMany(StockTransfer_1.StockTransfer, { foreignKey: "product_id", as: "transfers" });
StockTransfer_1.StockTransfer.belongsTo(Product_1.Product, { foreignKey: "product_id", as: "product" });
StockTransfer_1.StockTransfer.belongsTo(Shop_1.Shop, { foreignKey: "from_shop_id", as: "fromShop" });
StockTransfer_1.StockTransfer.belongsTo(Shop_1.Shop, { foreignKey: "to_shop_id", as: "toShop" });
/* ---------------- Customers ---------------- */
Owner_1.Owner.hasMany(Customer_1.Customer, { foreignKey: "owner_id", as: "customers" });
Customer_1.Customer.belongsTo(Owner_1.Owner, { foreignKey: "owner_id", as: "owner" });
/* ---------------- Sales (Billing) ---------------- */
Owner_1.Owner.hasMany(Sale_1.Sale, { foreignKey: "owner_id", as: "sales" });
Shop_1.Shop.hasMany(Sale_1.Sale, { foreignKey: "shop_id", as: "sales" });
Sale_1.Sale.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
Customer_1.Customer.hasMany(Sale_1.Sale, { foreignKey: "customer_id", as: "sales" });
Sale_1.Sale.belongsTo(Customer_1.Customer, { foreignKey: "customer_id", as: "customer" });
Sale_1.Sale.hasMany(SaleItem_1.SaleItem, { foreignKey: "sale_id", as: "items" });
SaleItem_1.SaleItem.belongsTo(Sale_1.Sale, { foreignKey: "sale_id", as: "sale" });
SaleItem_1.SaleItem.belongsTo(Product_1.Product, { foreignKey: "product_id", as: "product" });
Product_1.Product.hasMany(SaleItem_1.SaleItem, { foreignKey: "product_id", as: "saleItems" });
/* ---------------- Payments ---------------- */
Sale_1.Sale.hasMany(Payment_1.Payment, { foreignKey: "sale_id", as: "payments" });
Payment_1.Payment.belongsTo(Sale_1.Sale, { foreignKey: "sale_id", as: "sale" });
Customer_1.Customer.hasMany(Payment_1.Payment, { foreignKey: "customer_id", as: "payments" });
Payment_1.Payment.belongsTo(Customer_1.Customer, { foreignKey: "customer_id", as: "customer" });
Shop_1.Shop.hasMany(Payment_1.Payment, { foreignKey: "shop_id", as: "payments" });
Payment_1.Payment.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
/* ---------------- Customer Ledger ---------------- */
Customer_1.Customer.hasMany(CustomerLedger_1.CustomerLedger, { foreignKey: "customer_id", as: "ledgerEntries" });
CustomerLedger_1.CustomerLedger.belongsTo(Customer_1.Customer, { foreignKey: "customer_id", as: "customer" });
Shop_1.Shop.hasMany(CustomerLedger_1.CustomerLedger, { foreignKey: "shop_id", as: "ledgerEntries" });
CustomerLedger_1.CustomerLedger.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
/* ---------------- EMI ---------------- */
Sale_1.Sale.hasOne(EMIPlan_1.EMIPlan, { foreignKey: "sale_id", as: "emiPlan" });
EMIPlan_1.EMIPlan.belongsTo(Sale_1.Sale, { foreignKey: "sale_id", as: "sale" });
Customer_1.Customer.hasMany(EMIPlan_1.EMIPlan, { foreignKey: "customer_id", as: "emiPlans" });
EMIPlan_1.EMIPlan.belongsTo(Customer_1.Customer, { foreignKey: "customer_id", as: "customer" });
Shop_1.Shop.hasMany(EMIPlan_1.EMIPlan, { foreignKey: "shop_id", as: "emiPlans" });
EMIPlan_1.EMIPlan.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
EMIPlan_1.EMIPlan.hasMany(EMIInstallment_1.EMIInstallment, { foreignKey: "emi_plan_id", as: "installments" });
EMIInstallment_1.EMIInstallment.belongsTo(EMIPlan_1.EMIPlan, { foreignKey: "emi_plan_id", as: "emiPlan" });
EMIInstallment_1.EMIInstallment.hasMany(Payment_1.Payment, { foreignKey: "emi_installment_id", as: "payments" });
Payment_1.Payment.belongsTo(EMIInstallment_1.EMIInstallment, { foreignKey: "emi_installment_id", as: "installment" });
/* ---------------- Returns ---------------- */
Sale_1.Sale.hasMany(SaleReturn_1.SaleReturn, { foreignKey: "sale_id", as: "returns" });
SaleReturn_1.SaleReturn.belongsTo(Sale_1.Sale, { foreignKey: "sale_id", as: "sale" });
SaleReturn_1.SaleReturn.belongsTo(Customer_1.Customer, { foreignKey: "customer_id", as: "customer" });
SaleReturn_1.SaleReturn.hasMany(SaleReturn_1.SaleReturnItem, { foreignKey: "sale_return_id", as: "items" });
SaleReturn_1.SaleReturnItem.belongsTo(SaleReturn_1.SaleReturn, { foreignKey: "sale_return_id", as: "saleReturn" });
SaleReturn_1.SaleReturnItem.belongsTo(SaleItem_1.SaleItem, { foreignKey: "sale_item_id", as: "saleItem" });
SaleItem_1.SaleItem.hasMany(SaleReturn_1.SaleReturnItem, { foreignKey: "sale_item_id", as: "returnItems" });
/* ---------------- Attendance ---------------- */
Employee_1.Employee.hasMany(Attendance_1.Attendance, { foreignKey: "employee_id", as: "attendanceRecords" });
Attendance_1.Attendance.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
Shop_1.Shop.hasMany(Attendance_1.Attendance, { foreignKey: "shop_id", as: "attendanceRecords" });
Attendance_1.Attendance.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
/* ---------------- Leave ---------------- */
Employee_1.Employee.hasMany(LeaveRequest_1.LeaveRequest, { foreignKey: "employee_id", as: "leaveRequests" });
LeaveRequest_1.LeaveRequest.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
Shop_1.Shop.hasMany(LeaveRequest_1.LeaveRequest, { foreignKey: "shop_id", as: "leaveRequests" });
/* ---------------- Salary Config ---------------- */
Employee_1.Employee.hasMany(SalaryConfig_1.SalaryConfig, { foreignKey: "employee_id", as: "salaryConfigs" });
SalaryConfig_1.SalaryConfig.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
/* ---------------- Employee Advance ---------------- */
Employee_1.Employee.hasMany(EmployeeAdvance_1.EmployeeAdvance, { foreignKey: "employee_id", as: "advances" });
EmployeeAdvance_1.EmployeeAdvance.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
Shop_1.Shop.hasMany(EmployeeAdvance_1.EmployeeAdvance, { foreignKey: "shop_id", as: "advances" });
/* ---------------- Employee Incentive ---------------- */
Employee_1.Employee.hasMany(EmployeeIncentive_1.EmployeeIncentive, { foreignKey: "employee_id", as: "incentives" });
EmployeeIncentive_1.EmployeeIncentive.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
Shop_1.Shop.hasMany(EmployeeIncentive_1.EmployeeIncentive, { foreignKey: "shop_id", as: "incentives" });
/* ---------------- Payroll ---------------- */
Employee_1.Employee.hasMany(Payroll_1.Payroll, { foreignKey: "employee_id", as: "payrolls" });
Payroll_1.Payroll.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
Shop_1.Shop.hasMany(Payroll_1.Payroll, { foreignKey: "shop_id", as: "payrolls" });
Payroll_1.Payroll.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
Payroll_1.Payroll.hasMany(SalaryPayment_1.SalaryPayment, { foreignKey: "payroll_id", as: "payments" });
SalaryPayment_1.SalaryPayment.belongsTo(Payroll_1.Payroll, { foreignKey: "payroll_id", as: "payroll" });
Employee_1.Employee.hasMany(SalaryPayment_1.SalaryPayment, { foreignKey: "employee_id", as: "salaryPayments" });
SalaryPayment_1.SalaryPayment.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
/* ---------------- Employee Ledger ---------------- */
Employee_1.Employee.hasMany(EmployeeLedger_1.EmployeeLedger, { foreignKey: "employee_id", as: "ledgerEntries" });
EmployeeLedger_1.EmployeeLedger.belongsTo(Employee_1.Employee, { foreignKey: "employee_id", as: "employee" });
Shop_1.Shop.hasMany(EmployeeLedger_1.EmployeeLedger, { foreignKey: "shop_id", as: "employeeLedgerEntries" });
/* ---------------- Purchases ---------------- */
Owner_1.Owner.hasMany(Purchase_1.Purchase, { foreignKey: "owner_id", as: "purchases" });
Shop_1.Shop.hasMany(Purchase_1.Purchase, { foreignKey: "shop_id", as: "purchases" });
Purchase_1.Purchase.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
Supplier_1.Supplier.hasMany(Purchase_1.Purchase, { foreignKey: "supplier_id", as: "purchases" });
Purchase_1.Purchase.belongsTo(Supplier_1.Supplier, { foreignKey: "supplier_id", as: "supplier" });
Purchase_1.Purchase.hasMany(PurchaseItem_1.PurchaseItem, { foreignKey: "purchase_id", as: "items" });
PurchaseItem_1.PurchaseItem.belongsTo(Purchase_1.Purchase, { foreignKey: "purchase_id", as: "purchase" });
PurchaseItem_1.PurchaseItem.belongsTo(Product_1.Product, { foreignKey: "product_id", as: "product" });
Product_1.Product.hasMany(PurchaseItem_1.PurchaseItem, { foreignKey: "product_id", as: "purchaseItems" });
Purchase_1.Purchase.hasMany(SupplierPayment_1.SupplierPayment, { foreignKey: "purchase_id", as: "payments" });
SupplierPayment_1.SupplierPayment.belongsTo(Purchase_1.Purchase, { foreignKey: "purchase_id", as: "purchase" });
Supplier_1.Supplier.hasMany(SupplierPayment_1.SupplierPayment, { foreignKey: "supplier_id", as: "payments" });
SupplierPayment_1.SupplierPayment.belongsTo(Supplier_1.Supplier, { foreignKey: "supplier_id", as: "supplier" });
Shop_1.Shop.hasMany(SupplierPayment_1.SupplierPayment, { foreignKey: "shop_id", as: "supplierPayments" });
SupplierPayment_1.SupplierPayment.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
Supplier_1.Supplier.hasMany(SupplierLedger_1.SupplierLedger, { foreignKey: "supplier_id", as: "ledgerEntries" });
SupplierLedger_1.SupplierLedger.belongsTo(Supplier_1.Supplier, { foreignKey: "supplier_id", as: "supplier" });
Shop_1.Shop.hasMany(SupplierLedger_1.SupplierLedger, { foreignKey: "shop_id", as: "supplierLedgerEntries" });
SupplierLedger_1.SupplierLedger.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
Purchase_1.Purchase.hasMany(PurchaseReturn_1.PurchaseReturn, { foreignKey: "purchase_id", as: "returns" });
PurchaseReturn_1.PurchaseReturn.belongsTo(Purchase_1.Purchase, { foreignKey: "purchase_id", as: "purchase" });
PurchaseReturn_1.PurchaseReturn.belongsTo(Supplier_1.Supplier, { foreignKey: "supplier_id", as: "supplier" });
PurchaseReturn_1.PurchaseReturn.hasMany(PurchaseReturn_1.PurchaseReturnItem, { foreignKey: "purchase_return_id", as: "items" });
PurchaseReturn_1.PurchaseReturnItem.belongsTo(PurchaseReturn_1.PurchaseReturn, { foreignKey: "purchase_return_id", as: "purchaseReturn" });
PurchaseReturn_1.PurchaseReturnItem.belongsTo(PurchaseItem_1.PurchaseItem, { foreignKey: "purchase_item_id", as: "purchaseItem" });
PurchaseItem_1.PurchaseItem.hasMany(PurchaseReturn_1.PurchaseReturnItem, { foreignKey: "purchase_item_id", as: "returnItems" });
/* ---------------- Orders ---------------- */
Owner_1.Owner.hasMany(Order_1.Order, { foreignKey: "owner_id", as: "orders" });
Order_1.Order.belongsTo(Owner_1.Owner, { foreignKey: "owner_id", as: "owner" });
Shop_1.Shop.hasMany(Order_1.Order, { foreignKey: "shop_id", as: "orders" });
Order_1.Order.belongsTo(Shop_1.Shop, { foreignKey: "shop_id", as: "shop" });
Customer_1.Customer.hasMany(Order_1.Order, { foreignKey: "customer_id", as: "orders" });
Order_1.Order.belongsTo(Customer_1.Customer, { foreignKey: "customer_id", as: "customer" });
Order_1.Order.hasMany(OrderItem_1.OrderItem, { foreignKey: "order_id", as: "items" });
OrderItem_1.OrderItem.belongsTo(Order_1.Order, { foreignKey: "order_id", as: "order" });
Order_1.Order.belongsTo(Sale_1.Sale, { foreignKey: "converted_sale_id", as: "convertedSale" });
//# sourceMappingURL=index.js.map