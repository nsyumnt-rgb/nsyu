import sequelize from "../config/database";
import { Owner } from "./Owner";
import { Shop } from "./Shop";
import { Role } from "./Role";
import { RolePermission } from "./RolePermission";
import { RoleFieldPermission } from "./RoleFieldPermission";
import { Employee } from "./Employee";
import { EmployeeShop } from "./EmployeeShop";
import { RefreshToken } from "./RefreshToken";
import { AuditLog } from "./AuditLog";
import { Product } from "./Product";
import { Category } from "./Category";
import { Subcategory } from "./Subcategory";
import { Supplier } from "./Supplier";
import { ProductImage } from "./ProductImage";
import { ProductStock } from "./ProductStock";
import { ProductLocation } from "./ProductLocation";
import { InventoryTransaction } from "./InventoryTransaction";
import { StockTransfer } from "./StockTransfer";
import { Customer } from "./Customer";
import { Sale } from "./Sale";
import { SaleItem } from "./SaleItem";
import { Payment } from "./Payment";
import { CustomerLedger } from "./CustomerLedger";
import { EMIPlan } from "./EMIPlan";
import { EMIInstallment } from "./EMIInstallment";
import { SaleReturn, SaleReturnItem } from "./SaleReturn";
import { InvoiceCounter } from "./InvoiceCounter";
import { Attendance } from "./Attendance";
import { LeaveRequest } from "./LeaveRequest";
import { SalaryConfig } from "./SalaryConfig";
import { EmployeeAdvance } from "./EmployeeAdvance";
import { EmployeeIncentive } from "./EmployeeIncentive";
import { Payroll } from "./Payroll";
import { SalaryPayment } from "./SalaryPayment";
import { EmployeeLedger } from "./EmployeeLedger";
import { Notification } from "./Notification";
import { PurchaseCounter } from "./PurchaseCounter";
import { Purchase } from "./Purchase";
import { PurchaseItem } from "./PurchaseItem";
import { SupplierPayment } from "./SupplierPayment";
import { SupplierLedger } from "./SupplierLedger";
import { PurchaseReturn, PurchaseReturnItem } from "./PurchaseReturn";
import { Order } from "./Order";
import { OrderItem } from "./OrderItem";
import { VisibilitySettings, DEFAULT_VISIBILITY_SETTINGS } from "./VisibilitySettings";

/* ---------------- Owner ---------------- */
Owner.hasMany(Shop, { foreignKey: "owner_id", as: "shops" });
Shop.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

Owner.hasMany(Employee, { foreignKey: "owner_id", as: "employees" });
Employee.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

Owner.hasMany(Role, { foreignKey: "owner_id", as: "roles" });
Role.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

/* ---------------- Roles & Permissions ---------------- */
Role.hasMany(RolePermission, { foreignKey: "role_id", as: "permissions" });
RolePermission.belongsTo(Role, { foreignKey: "role_id", as: "role" });

Role.hasMany(RoleFieldPermission, { foreignKey: "role_id", as: "fieldPermissions" });
RoleFieldPermission.belongsTo(Role, { foreignKey: "role_id", as: "role" });

/* ---------------- Employee <-> Shop (many-to-many, role per shop) ---------------- */
Employee.hasMany(EmployeeShop, { foreignKey: "employee_id", as: "shopAssignments" });
EmployeeShop.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

Shop.hasMany(EmployeeShop, { foreignKey: "shop_id", as: "employeeAssignments" });
EmployeeShop.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

Role.hasMany(EmployeeShop, { foreignKey: "role_id", as: "employeeAssignments" });
EmployeeShop.belongsTo(Role, { foreignKey: "role_id", as: "role" });

/* ---------------- Refresh Tokens ---------------- */
Owner.hasMany(RefreshToken, { foreignKey: "owner_id", as: "refreshTokens" });
Employee.hasMany(RefreshToken, { foreignKey: "employee_id", as: "refreshTokens" });

/* ---------------- Audit Logs ---------------- */
Owner.hasMany(AuditLog, { foreignKey: "owner_id", as: "auditLogs" });
Shop.hasMany(AuditLog, { foreignKey: "shop_id", as: "auditLogs" });

/* ---------------- Categories ---------------- */
Owner.hasMany(Category, { foreignKey: "owner_id", as: "categories" });
Category.hasMany(Subcategory, { foreignKey: "category_id", as: "subcategories" });
Subcategory.belongsTo(Category, { foreignKey: "category_id", as: "category" });

/* ---------------- Suppliers ---------------- */
Owner.hasMany(Supplier, { foreignKey: "owner_id", as: "suppliers" });

/* ---------------- Products (owner-level catalog) ---------------- */
Owner.hasMany(Product, { foreignKey: "owner_id", as: "products" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });
Product.belongsTo(Subcategory, { foreignKey: "subcategory_id", as: "subcategory" });
Product.belongsTo(Supplier, { foreignKey: "supplier_id", as: "supplier" });

Product.hasMany(ProductImage, { foreignKey: "product_id", as: "images" });
ProductImage.belongsTo(Product, { foreignKey: "product_id", as: "product" });

/* ---------------- Per-shop stock ---------------- */
Product.hasMany(ProductStock, { foreignKey: "product_id", as: "stocks" });
ProductStock.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Shop.hasMany(ProductStock, { foreignKey: "shop_id", as: "productStocks" });
ProductStock.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- Per-shop location history ---------------- */
Product.hasMany(ProductLocation, { foreignKey: "product_id", as: "locations" });
ProductLocation.belongsTo(Product, { foreignKey: "product_id", as: "product" });
ProductLocation.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- Inventory ledger ---------------- */
Product.hasMany(InventoryTransaction, { foreignKey: "product_id", as: "inventoryTransactions" });
InventoryTransaction.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Shop.hasMany(InventoryTransaction, { foreignKey: "shop_id", as: "inventoryTransactions" });
InventoryTransaction.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- Stock transfers ---------------- */
Product.hasMany(StockTransfer, { foreignKey: "product_id", as: "transfers" });
StockTransfer.belongsTo(Product, { foreignKey: "product_id", as: "product" });
StockTransfer.belongsTo(Shop, { foreignKey: "from_shop_id", as: "fromShop" });
StockTransfer.belongsTo(Shop, { foreignKey: "to_shop_id", as: "toShop" });

/* ---------------- Customers ---------------- */
Owner.hasMany(Customer, { foreignKey: "owner_id", as: "customers" });
Customer.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

/* ---------------- Sales (Billing) ---------------- */
Owner.hasMany(Sale, { foreignKey: "owner_id", as: "sales" });
Shop.hasMany(Sale, { foreignKey: "shop_id", as: "sales" });
Sale.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });
Customer.hasMany(Sale, { foreignKey: "customer_id", as: "sales" });
Sale.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

Sale.hasMany(SaleItem, { foreignKey: "sale_id", as: "items" });
SaleItem.belongsTo(Sale, { foreignKey: "sale_id", as: "sale" });
SaleItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Product.hasMany(SaleItem, { foreignKey: "product_id", as: "saleItems" });

/* ---------------- Payments ---------------- */
Sale.hasMany(Payment, { foreignKey: "sale_id", as: "payments" });
Payment.belongsTo(Sale, { foreignKey: "sale_id", as: "sale" });
Customer.hasMany(Payment, { foreignKey: "customer_id", as: "payments" });
Payment.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Shop.hasMany(Payment, { foreignKey: "shop_id", as: "payments" });
Payment.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- Customer Ledger ---------------- */
Customer.hasMany(CustomerLedger, { foreignKey: "customer_id", as: "ledgerEntries" });
CustomerLedger.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Shop.hasMany(CustomerLedger, { foreignKey: "shop_id", as: "ledgerEntries" });
CustomerLedger.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- EMI ---------------- */
Sale.hasOne(EMIPlan, { foreignKey: "sale_id", as: "emiPlan" });
EMIPlan.belongsTo(Sale, { foreignKey: "sale_id", as: "sale" });
Customer.hasMany(EMIPlan, { foreignKey: "customer_id", as: "emiPlans" });
EMIPlan.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Shop.hasMany(EMIPlan, { foreignKey: "shop_id", as: "emiPlans" });
EMIPlan.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

EMIPlan.hasMany(EMIInstallment, { foreignKey: "emi_plan_id", as: "installments" });
EMIInstallment.belongsTo(EMIPlan, { foreignKey: "emi_plan_id", as: "emiPlan" });
EMIInstallment.hasMany(Payment, { foreignKey: "emi_installment_id", as: "payments" });
Payment.belongsTo(EMIInstallment, { foreignKey: "emi_installment_id", as: "installment" });

/* ---------------- Returns ---------------- */
Sale.hasMany(SaleReturn, { foreignKey: "sale_id", as: "returns" });
SaleReturn.belongsTo(Sale, { foreignKey: "sale_id", as: "sale" });
SaleReturn.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

SaleReturn.hasMany(SaleReturnItem, { foreignKey: "sale_return_id", as: "items" });
SaleReturnItem.belongsTo(SaleReturn, { foreignKey: "sale_return_id", as: "saleReturn" });
SaleReturnItem.belongsTo(SaleItem, { foreignKey: "sale_item_id", as: "saleItem" });
SaleItem.hasMany(SaleReturnItem, { foreignKey: "sale_item_id", as: "returnItems" });

/* ---------------- Attendance ---------------- */
Employee.hasMany(Attendance, { foreignKey: "employee_id", as: "attendanceRecords" });
Attendance.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });
Shop.hasMany(Attendance, { foreignKey: "shop_id", as: "attendanceRecords" });
Attendance.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- Leave ---------------- */
Employee.hasMany(LeaveRequest, { foreignKey: "employee_id", as: "leaveRequests" });
LeaveRequest.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });
Shop.hasMany(LeaveRequest, { foreignKey: "shop_id", as: "leaveRequests" });

/* ---------------- Salary Config ---------------- */
Employee.hasMany(SalaryConfig, { foreignKey: "employee_id", as: "salaryConfigs" });
SalaryConfig.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

/* ---------------- Employee Advance ---------------- */
Employee.hasMany(EmployeeAdvance, { foreignKey: "employee_id", as: "advances" });
EmployeeAdvance.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });
Shop.hasMany(EmployeeAdvance, { foreignKey: "shop_id", as: "advances" });

/* ---------------- Employee Incentive ---------------- */
Employee.hasMany(EmployeeIncentive, { foreignKey: "employee_id", as: "incentives" });
EmployeeIncentive.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });
Shop.hasMany(EmployeeIncentive, { foreignKey: "shop_id", as: "incentives" });

/* ---------------- Payroll ---------------- */
Employee.hasMany(Payroll, { foreignKey: "employee_id", as: "payrolls" });
Payroll.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });
Shop.hasMany(Payroll, { foreignKey: "shop_id", as: "payrolls" });
Payroll.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });
Payroll.hasMany(SalaryPayment, { foreignKey: "payroll_id", as: "payments" });
SalaryPayment.belongsTo(Payroll, { foreignKey: "payroll_id", as: "payroll" });
Employee.hasMany(SalaryPayment, { foreignKey: "employee_id", as: "salaryPayments" });
SalaryPayment.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

/* ---------------- Employee Ledger ---------------- */
Employee.hasMany(EmployeeLedger, { foreignKey: "employee_id", as: "ledgerEntries" });
EmployeeLedger.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });
Shop.hasMany(EmployeeLedger, { foreignKey: "shop_id", as: "employeeLedgerEntries" });

/* ---------------- Purchases ---------------- */
Owner.hasMany(Purchase, { foreignKey: "owner_id", as: "purchases" });
Shop.hasMany(Purchase, { foreignKey: "shop_id", as: "purchases" });
Purchase.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });
Supplier.hasMany(Purchase, { foreignKey: "supplier_id", as: "purchases" });
Purchase.belongsTo(Supplier, { foreignKey: "supplier_id", as: "supplier" });

Purchase.hasMany(PurchaseItem, { foreignKey: "purchase_id", as: "items" });
PurchaseItem.belongsTo(Purchase, { foreignKey: "purchase_id", as: "purchase" });
PurchaseItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Product.hasMany(PurchaseItem, { foreignKey: "product_id", as: "purchaseItems" });

Purchase.hasMany(SupplierPayment, { foreignKey: "purchase_id", as: "payments" });
SupplierPayment.belongsTo(Purchase, { foreignKey: "purchase_id", as: "purchase" });
Supplier.hasMany(SupplierPayment, { foreignKey: "supplier_id", as: "payments" });
SupplierPayment.belongsTo(Supplier, { foreignKey: "supplier_id", as: "supplier" });
Shop.hasMany(SupplierPayment, { foreignKey: "shop_id", as: "supplierPayments" });
SupplierPayment.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

Supplier.hasMany(SupplierLedger, { foreignKey: "supplier_id", as: "ledgerEntries" });
SupplierLedger.belongsTo(Supplier, { foreignKey: "supplier_id", as: "supplier" });
Shop.hasMany(SupplierLedger, { foreignKey: "shop_id", as: "supplierLedgerEntries" });
SupplierLedger.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

Purchase.hasMany(PurchaseReturn, { foreignKey: "purchase_id", as: "returns" });
PurchaseReturn.belongsTo(Purchase, { foreignKey: "purchase_id", as: "purchase" });
PurchaseReturn.belongsTo(Supplier, { foreignKey: "supplier_id", as: "supplier" });
PurchaseReturn.hasMany(PurchaseReturnItem, { foreignKey: "purchase_return_id", as: "items" });
PurchaseReturnItem.belongsTo(PurchaseReturn, { foreignKey: "purchase_return_id", as: "purchaseReturn" });
PurchaseReturnItem.belongsTo(PurchaseItem, { foreignKey: "purchase_item_id", as: "purchaseItem" });
PurchaseItem.hasMany(PurchaseReturnItem, { foreignKey: "purchase_item_id", as: "returnItems" });

/* ---------------- Orders ---------------- */
Owner.hasMany(Order, { foreignKey: "owner_id", as: "orders" });
Order.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

Shop.hasMany(Order, { foreignKey: "shop_id", as: "orders" });
Order.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

Customer.hasMany(Order, { foreignKey: "customer_id", as: "orders" });
Order.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });

Order.belongsTo(Sale, { foreignKey: "converted_sale_id", as: "convertedSale" });

export {
  sequelize,
  Owner,
  Shop,
  Role,
  RolePermission,
  RoleFieldPermission,
  Employee,
  EmployeeShop,
  RefreshToken,
  AuditLog,
  Product,
  Category,
  Subcategory,
  Supplier,
  ProductImage,
  ProductStock,
  ProductLocation,
  InventoryTransaction,
  StockTransfer,
  Customer,
  Sale,
  SaleItem,
  Payment,
  CustomerLedger,
  EMIPlan,
  EMIInstallment,
  SaleReturn,
  SaleReturnItem,
  InvoiceCounter,
  Attendance,
  LeaveRequest,
  SalaryConfig,
  EmployeeAdvance,
  EmployeeIncentive,
  Payroll,
  SalaryPayment,
  EmployeeLedger,
  Notification,
  PurchaseCounter,
  Purchase,
  PurchaseItem,
  SupplierPayment,
  SupplierLedger,
  PurchaseReturn,
  PurchaseReturnItem,
  Order,
  OrderItem,
  VisibilitySettings,
  DEFAULT_VISIBILITY_SETTINGS,
};
