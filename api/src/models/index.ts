import sequelize from "../config/database";
import { Owner } from "./Owner";
import { Shop } from "./Shop";
import { Role } from "./Role";
import { RolePermission } from "./RolePermission";
import { RoleFieldPermission } from "./RoleFieldPermission";
import { RefreshToken } from "./RefreshToken";
import { AuditLog } from "./AuditLog";
import { Product } from "./Product";
import { Category } from "./Category";
import { Subcategory } from "./Subcategory";
import { ProductImage } from "./ProductImage";
import { ProductStock } from "./ProductStock";
import { InventoryTransaction } from "./InventoryTransaction";
import { Customer } from "./Customer";
import { Sale } from "./Sale";
import { SaleItem } from "./SaleItem";
import { CustomerLedger } from "./CustomerLedger";
import { SaleReturn, SaleReturnItem } from "./SaleReturn";
import { InvoiceCounter } from "./InvoiceCounter";
import { Notification } from "./Notification";
import { Order } from "./Order";
import { OrderItem } from "./OrderItem";
import { VisibilitySettings, DEFAULT_VISIBILITY_SETTINGS } from "./VisibilitySettings";
import { Module } from "./Module";
import { Permission } from "./Permission";
import { ShopModule } from "./ShopModule";
import { UserRole } from "./UserRole";
import { CustomerAccount } from "./CustomerAccount";
import { CustomerOtp } from "./CustomerOtp";
import { CustomerRefreshToken } from "./CustomerRefreshToken";
import { CustomerCart } from "./CustomerCart";
import { CustomerCartItem } from "./CustomerCartItem";
import { OrderStatusHistory } from "./OrderStatusHistory";
import { ShopPortalSettings } from "./ShopPortalSettings";
import { PlatformAuditLog } from "./PlatformAuditLog";
import { StatusHistory } from "./StatusHistory";

/* ---------------- Owner ---------------- */
Owner.hasMany(Shop, { foreignKey: "owner_id", as: "shops" });
Shop.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

Shop.hasMany(StatusHistory, { foreignKey: "shop_id", as: "statusHistories" });
StatusHistory.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

Owner.hasMany(Role, { foreignKey: "owner_id", as: "roles" });
Role.belongsTo(Owner, { foreignKey: "owner_id", as: "owner" });

/* ---------------- Roles & Permissions ---------------- */
Role.hasMany(RolePermission, { foreignKey: "role_id", as: "permissions" });
RolePermission.belongsTo(Role, { foreignKey: "role_id", as: "role" });

Role.hasMany(RoleFieldPermission, { foreignKey: "role_id", as: "fieldPermissions" });
RoleFieldPermission.belongsTo(Role, { foreignKey: "role_id", as: "role" });

Module.hasMany(Permission, { foreignKey: "module_id", as: "permissions" });
Permission.belongsTo(Module, { foreignKey: "module_id", as: "module" });

Module.hasMany(RolePermission, { foreignKey: "module_id", as: "rolePermissions" });
RolePermission.belongsTo(Module, { foreignKey: "module_id", as: "moduleDetails" });

Shop.hasMany(ShopModule, { foreignKey: "shop_id", as: "modules" });
ShopModule.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

Module.hasMany(ShopModule, { foreignKey: "module_id", as: "shopModules" });
ShopModule.belongsTo(Module, { foreignKey: "module_id", as: "module" });

Role.hasMany(UserRole, { foreignKey: "role_id", as: "userRoles" });
UserRole.belongsTo(Role, { foreignKey: "role_id", as: "role" });

Shop.hasMany(UserRole, { foreignKey: "shop_id", as: "userRoles" });
UserRole.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- Refresh Tokens ---------------- */
Owner.hasMany(RefreshToken, { foreignKey: "owner_id", as: "refreshTokens" });

/* ---------------- Audit Logs ---------------- */
Owner.hasMany(AuditLog, { foreignKey: "owner_id", as: "auditLogs" });
Shop.hasMany(AuditLog, { foreignKey: "shop_id", as: "auditLogs" });

/* ---------------- Categories ---------------- */
Owner.hasMany(Category, { foreignKey: "owner_id", as: "categories" });
Category.hasMany(Subcategory, { foreignKey: "category_id", as: "subcategories" });
Subcategory.belongsTo(Category, { foreignKey: "category_id", as: "category" });

/* ---------------- Products (owner-level catalog) ---------------- */
Owner.hasMany(Product, { foreignKey: "owner_id", as: "products" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });
Product.belongsTo(Subcategory, { foreignKey: "subcategory_id", as: "subcategory" });
Product.hasMany(ProductImage, { foreignKey: "product_id", as: "images" });
ProductImage.belongsTo(Product, { foreignKey: "product_id", as: "product" });

/* ---------------- Per-shop stock ---------------- */
Product.hasMany(ProductStock, { foreignKey: "product_id", as: "stocks" });
ProductStock.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Shop.hasMany(ProductStock, { foreignKey: "shop_id", as: "productStocks" });
ProductStock.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

/* ---------------- Inventory ledger ---------------- */
Product.hasMany(InventoryTransaction, { foreignKey: "product_id", as: "inventoryTransactions" });
InventoryTransaction.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Shop.hasMany(InventoryTransaction, { foreignKey: "shop_id", as: "inventoryTransactions" });
InventoryTransaction.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

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

/* ---------------- Customer Ledger (Single Ledger Architecture) ---------------- */
Customer.hasMany(CustomerLedger, { foreignKey: "customer_id", as: "ledgerEntries" });
CustomerLedger.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Shop.hasMany(CustomerLedger, { foreignKey: "shop_id", as: "ledgerEntries" });
CustomerLedger.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });
Sale.hasMany(CustomerLedger, {
  foreignKey: "reference_id",
  as: "payments",
  scope: { entry_type: "credit", reference_type: "SalePayment", status: "active" },
  constraints: false,
});
CustomerLedger.belongsTo(Sale, { foreignKey: "reference_id", as: "sale", constraints: false });

/* ---------------- Returns ---------------- */
Sale.hasMany(SaleReturn, { foreignKey: "sale_id", as: "returns" });
SaleReturn.belongsTo(Sale, { foreignKey: "sale_id", as: "sale" });
SaleReturn.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

SaleReturn.hasMany(SaleReturnItem, { foreignKey: "sale_return_id", as: "items" });
SaleReturnItem.belongsTo(SaleReturn, { foreignKey: "sale_return_id", as: "saleReturn" });
SaleReturnItem.belongsTo(SaleItem, { foreignKey: "sale_item_id", as: "saleItem" });
SaleItem.hasMany(SaleReturnItem, { foreignKey: "sale_item_id", as: "returnItems" });

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
Sale.belongsTo(Order, { foreignKey: "order_id", as: "sourceOrder" });
Order.hasOne(Sale, { foreignKey: "order_id", as: "billedSale" });
CustomerLedger.belongsTo(Sale, { foreignKey: "sale_id", as: "linkedSale" });

/* ---------------- Customer Portal ---------------- */
Customer.hasOne(CustomerAccount, { foreignKey: "customer_id", as: "account" });
CustomerAccount.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
CustomerAccount.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

CustomerAccount.hasMany(CustomerRefreshToken, { foreignKey: "account_id", as: "refreshTokens" });
CustomerRefreshToken.belongsTo(CustomerAccount, { foreignKey: "account_id", as: "account" });

Customer.hasOne(CustomerCart, { foreignKey: "customer_id", as: "cart" });
CustomerCart.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
CustomerCart.hasMany(CustomerCartItem, { foreignKey: "cart_id", as: "items" });
CustomerCartItem.belongsTo(CustomerCart, { foreignKey: "cart_id", as: "cart" });
CustomerCartItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });

Order.hasMany(OrderStatusHistory, { foreignKey: "order_id", as: "statusHistory" });
OrderStatusHistory.belongsTo(Order, { foreignKey: "order_id", as: "order" });

Shop.hasOne(ShopPortalSettings, { foreignKey: "shop_id", as: "portalSettings" });
ShopPortalSettings.belongsTo(Shop, { foreignKey: "shop_id", as: "shop" });

export {
  sequelize,
  Owner,
  Shop,
  Role,
  RolePermission,
  RoleFieldPermission,
  RefreshToken,
  AuditLog,
  Product,
  Category,
  Subcategory,
  ProductImage,
  ProductStock,
  InventoryTransaction,
  Customer,
  Sale,
  SaleItem,
  CustomerLedger,
  SaleReturn,
  SaleReturnItem,
  InvoiceCounter,
  Notification,
  Order,
  OrderItem,
  VisibilitySettings,
  DEFAULT_VISIBILITY_SETTINGS,
  Module,
  Permission,
  ShopModule,
  UserRole,
  CustomerAccount,
  CustomerOtp,
  CustomerRefreshToken,
  CustomerCart,
  CustomerCartItem,
  OrderStatusHistory,
  ShopPortalSettings,
  PlatformAuditLog,
  StatusHistory,
};
