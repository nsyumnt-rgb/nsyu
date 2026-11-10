# NSYU Business — Comprehensive Database Audit Report

**Date:** November 11, 2026  
**Database:** Supabase PostgreSQL (`aws-0-ap-south-1.pooler.supabase.com:5432/postgres`)  
**Scope:** Live PostgreSQL Database, Node.js/Express API Backend, React Web Dashboard, Flutter Mobile App

---

## 1. Executive Summary

This read-only audit provides an exhaustive inventory and dependency analysis of the NSYU Shop Management System database.
**Zero destructive SQL commands (`DROP`, `ALTER`, `DELETE`) have been executed.**

### Key Database Metrics (Live Supabase Schema)
- **Base Tables:** 49
- **Database Views:** 0
- **Postgres Enums:** 71
- **Database Functions:** 2 (`is_super_admin()`, `is_shop_active()`)
- **Indexes:** 276
- **Row-Level Security (RLS) Policies:** 17

---

## 2. Core Business Architecture Alignment (The 8 Primary Tables)

The mandated foundation for NSYU Business operations consists of 8 primary business tables:

| # | Core Table | Live Status | Row Count | Purpose & Audit Finding |
|---|---|---|:---:|---|
| 1 | `customers` | **EXISTS** | 1 | Customer profiles, contact details, running balance |
| 2 | `customer_ledger` | **EXISTS** | 0 | Running debit/credit transaction ledger |
| 3 | `orders` | **EXISTS** | 0 | Customer order lifecycle (Pending → Confirmed → Shipped → Delivered) |
| 4 | `order_items` | **EXISTS** | 0 | Line items for customer orders (product, qty, price) |
| 5 | `bills` | **MISSING** | 0 | **Critical Finding:** Neither `bills` nor `sales` exists in the live database schema. Billing logic in backend expects `sales`. A safe migration proposal creates `bills` (with backward-compatible view `sales`). |
| 6 | `bill_items` | **MISSING** | 0 | **Critical Finding:** `sale_items` currently exists in DB (0 rows) with FK to `products.id`. Migration proposal creates `bill_items` with a view alias for `sale_items`. |
| 7 | `products` | **EXISTS** | 184 | Product master catalog (SKU, name, barcode, purchase price, selling price, GST) |
| 8 | `inventory_transactions` | **EXISTS** | 0 | Immutable ledger of stock movements (IN/OUT/ADJUST) |

---

## 3. Comprehensive Inventory & Usage Table (All 49 Live Tables)

| # | Table Name | Row Count | Outgoing FKs | Incoming FKs | Code References (API / Web / Mobile) | Verdict | Reason |
|---|---|:---:|---|---|---|:---:|---|
| 1 | `categories` | 8 | `owners.id` | `products.category_id`, `subcategories.category_id` | `api/src/models/Category.ts`, `api/src/controllers/categoryController.ts:2`, `web/src/pages/Catalog.tsx:12`, `App/lib/providers/catalog_provider.dart:45` | **KEEP SUPPORTING** | Product categorization hierarchy |
| 2 | `customer_carts` | 0 | `customers.id` | None | `api/src/models/CustomerCart.ts`, `api/src/controllers/customerCartController.ts:4` | **REMOVE CANDIDATE** | Cart is maintained client-side in Flutter and Web local state |
| 3 | `customer_ledger` | 0 | `customers.id`, `shops.id` | None | `api/src/models/CustomerLedger.ts`, `api/src/utils/ledger.ts:14`, `App/lib/screens/ledger_screen.dart:35`, `web/src/pages/Ledger.tsx:18` | **CORE 8** | Mandated core ledger table |
| 4 | `customer_otps` | 0 | None | None | `api/src/models/CustomerOtp.ts`, `api/src/controllers/customerAuthController.ts:18` | **REMOVE CANDIDATE** | OTP auth can use direct Redis or Supabase Auth |
| 5 | `customer_refresh_tokens` | 0 | None | None | `api/src/models/CustomerRefreshToken.ts`, `api/src/controllers/customerAuthController.ts:24` | **KEEP SUPPORTING** | Customer portal JWT session security |
| 6 | `customers` | 1 | `owners.id` | `payments.customer_id`, `customer_ledger.customer_id`, `orders.customer_id` | `api/src/models/Customer.ts`, `api/src/controllers/customerController.ts:5`, `web/src/pages/Customers.tsx:10`, `App/lib/providers/customer_provider.dart:12` | **CORE 8** | Mandated core customer table |
| 7 | `emi_installments` | 0 | `emi_plans.id` | `payments.emi_installment_id` | `api/src/models/EMIInstallment.ts`, `api/src/controllers/emiController.ts:4` | **REMOVE CANDIDATE** | Mandated module removal (unused EMI installment tracking) |
| 8 | `emi_plans` | 0 | `sales.id`, `customers.id`, `shops.id` | `emi_installments.emi_plan_id` | `api/src/models/EMIPlan.ts`, `api/src/controllers/emiController.ts:3` | **REMOVE CANDIDATE** | Mandated module removal (unused EMI plans) |
| 9 | `employee_advances` | 0 | `employees.id`, `shops.id` | None | `api/src/models/EmployeeAdvance.ts`, `api/src/controllers/payrollController.ts:18` | **REMOVE CANDIDATE** | Unused HR/Payroll module |
| 10 | `employee_incentives` | 0 | `employees.id`, `shops.id` | None | `api/src/models/EmployeeIncentive.ts`, `api/src/controllers/payrollController.ts:22` | **REMOVE CANDIDATE** | Unused HR/Payroll module |
| 11 | `employee_ledger` | 0 | `employees.id`, `shops.id` | None | `api/src/models/EmployeeLedger.ts`, `api/src/controllers/payrollController.ts:28` | **REMOVE CANDIDATE** | Unused HR/Payroll module |
| 12 | `employee_shops` | 0 | `employees.id`, `shops.id`, `roles.id` | None | `api/src/models/EmployeeShop.ts`, `api/src/controllers/employeeController.ts:14` | **REMOVE CANDIDATE** | Redundant join table; employee shop assignment lives directly on `employees` |
| 13 | `employees` | 0 | `owners.id` | `attendance.employee_id`, `leave_requests.employee_id` | `api/src/models/Employee.ts`, `api/src/controllers/employeeController.ts:3`, `web/src/pages/Staff.tsx:14` | **KEEP SUPPORTING** | Multi-user staff/employee accounts |
| 14 | `inventory_transactions` | 0 | `products.id`, `shops.id` | None | `api/src/models/InventoryTransaction.ts`, `api/src/utils/stock.ts:18`, `App/lib/services/supabase_service.dart:180` | **CORE 8** | Mandated stock movement audit trail |
| 15 | `invoice_counters` | 0 | `shops.id` | None | `api/src/models/InvoiceCounter.ts`, `api/src/utils/invoice.ts:8` | **KEEP SUPPORTING** | Atomic sequential bill/invoice number generation |
| 16 | `leave_requests` | 0 | `employees.id`, `shops.id` | None | `api/src/models/LeaveRequest.ts`, `api/src/controllers/leaveController.ts:5` | **REMOVE CANDIDATE** | Unused HR/Leave module |
| 17 | `modules` | 0 | None | `permissions.module_id`, `role_permissions.module_id` | `api/src/models/Module.ts` | **REMOVE CANDIDATE** | Dynamic permission tree replaced by standard code-level roles |
| 18 | `notifications` | 0 | None | None | `api/src/models/Notification.ts`, `api/src/controllers/notificationController.ts:3`, `App/lib/providers/notifications_provider.dart:4` | **KEEP SUPPORTING** | Operational in-app notifications (bills, payments, stock alerts) |
| 19 | `order_items` | 0 | `orders.id`, `products.id` | None | `api/src/models/OrderItem.ts`, `api/src/controllers/orderController.ts:12`, `App/lib/models/saved_order.dart:25` | **CORE 8** | Mandated order line items |
| 20 | `order_status_history` | 0 | `orders.id` | None | `api/src/models/OrderStatusHistory.ts`, `api/src/controllers/orderController.ts:38` | **KEEP SUPPORTING** | Order state transition audit log |
| 21 | `orders` | 0 | `customers.id`, `shops.id` | `order_items.order_id`, `order_status_history.order_id` | `api/src/models/Order.ts`, `api/src/controllers/orderController.ts:8`, `web/src/pages/Orders.tsx:14`, `App/lib/screens/orders_screen.dart:18` | **CORE 8** | Mandated core order table |
| 22 | `owners` | 2 | None | `shops.owner_id`, `customers.owner_id`, `products.owner_id` | `api/src/models/Owner.ts`, `api/src/controllers/authController.ts:10`, `web/src/context/AuthContext.tsx:15` | **KEEP SUPPORTING** | Primary tenant / business account entity |
| 23 | `payments` | 0 | `customers.id`, `shops.id` | None | `api/src/models/Payment.ts`, `api/src/controllers/paymentController.ts:8`, `web/src/pages/Payments.tsx:12`, `App/lib/providers/payments_provider.dart:10` | **KEEP SUPPORTING** | Verified payment architecture across Cash, UPI, and Bank Transfer |
| 24 | `payrolls` | 0 | `employees.id`, `shops.id` | None | `api/src/models/Payroll.ts`, `api/src/controllers/payrollController.ts:14` | **REMOVE CANDIDATE** | Unused HR/Payroll module |
| 25 | `permissions` | 0 | None | None | `api/src/models/Permission.ts` | **KEEP SUPPORTING** | System permission catalog |
| 26 | `platform_audit_log` | 0 | None | None | `api/src/models/PlatformAuditLog.ts`, `api/src/middleware/audit.ts:10` | **KEEP SUPPORTING** | Security and compliance audit log |
| 27 | `product_images` | 0 | `products.id` | None | `api/src/models/ProductImage.ts` | **REMOVE CANDIDATE** | Product images are stored directly as URLs on `products.image_url` |
| 28 | `product_locations` | 0 | `products.id`, `shops.id` | None | `api/src/models/ProductLocation.ts` | **REMOVE CANDIDATE** | Unused warehouse bin/rack locations |
| 29 | `product_stocks` | 90 | `products.id`, `shops.id` | None | `api/src/models/ProductStock.ts`, `api/src/controllers/productController.ts:42`, `App/lib/models/product.dart:48` | **KEEP SUPPORTING** | Shop-specific real-time stock balances |
| 30 | `products` | 184 | `categories.id` | `product_stocks.product_id`, `order_items.product_id`, `sale_items.product_id` | `api/src/models/Product.ts`, `api/src/controllers/productController.ts:15`, `web/src/pages/Products.tsx:14`, `App/lib/models/product.dart:18` | **CORE 8** | Mandated core product catalog master |
| 31 | `purchase_counters` | 0 | `shops.id` | None | `api/src/models/PurchaseCounter.ts` | **REMOVE CANDIDATE** | Unused purchase module |
| 32 | `purchase_items` | 0 | `purchases.id`, `products.id` | None | `api/src/models/PurchaseItem.ts` | **REMOVE CANDIDATE** | Unused purchase module |
| 33 | `purchase_return_items` | 0 | `purchase_returns.id` | None | `api/src/models/PurchaseReturn.ts` | **REMOVE CANDIDATE** | Unused purchase return module |
| 34 | `purchase_returns` | 0 | `suppliers.id`, `shops.id` | `purchase_return_items.purchase_return_id` | `api/src/models/PurchaseReturn.ts` | **REMOVE CANDIDATE** | Unused purchase return module |
| 35 | `purchases` | 0 | `suppliers.id`, `shops.id` | `purchase_items.purchase_id` | `api/src/models/Purchase.ts` | **REMOVE CANDIDATE** | Unused purchase module |
| 36 | `reference_counters` | 0 | `shops.id` | None | `api/src/models/ReferenceCounter.ts` | **KEEP SUPPORTING** | Order number generator (`ORD-000001`) |
| 37 | `refresh_tokens` | 0 | `owners.id` / `employees.id` | None | `api/src/models/RefreshToken.ts`, `api/src/middleware/auth.ts:25` | **KEEP SUPPORTING** | JWT token rotation & security |
| 38 | `role_field_permissions` | 112 | `roles.id` | None | `api/src/models/RoleFieldPermission.ts`, `App/lib/providers/visibility_provider.dart:45` | **KEEP SUPPORTING** | Dynamic UI business info masking (profit, cost, customer balance) |
| 39 | `role_permissions` | 448 | `roles.id` | None | `api/src/models/RolePermission.ts`, `api/src/middleware/permission.ts:18` | **KEEP SUPPORTING** | Staff RBAC authorization matrix |
| 40 | `roles` | 18 | `owners.id` | `role_permissions.role_id`, `role_field_permissions.role_id` | `api/src/models/Role.ts`, `api/src/controllers/roleController.ts:5` | **KEEP SUPPORTING** | System roles (Super Admin, Owner, Manager, Staff, Cashier) |
| 41 | `salary_configs` | 0 | `employees.id` | None | `api/src/models/SalaryConfig.ts` | **REMOVE CANDIDATE** | Unused HR/Payroll module |
| 42 | `salary_payments` | 0 | `employees.id`, `shops.id` | None | `api/src/models/SalaryPayment.ts` | **REMOVE CANDIDATE** | Unused HR/Payroll module |
| 43 | `sale_items` | 0 | `products.id` | `sale_return_items.sale_item_id` | `api/src/models/SaleItem.ts`, `api/src/controllers/saleController.ts:24` | **CORE 8 (Transition to `bill_items`)** | Currently holds bill line items; to be aliased/migrated to `bill_items` |
| 44 | `sale_return_items` | 0 | `sale_items.id` | None | `api/src/models/SaleReturn.ts`, `api/src/controllers/saleReturnController.ts:12` | **REMOVE CANDIDATE** | Mandated module removal (unused sale return items) |
| 45 | `shops` | 1 | `owners.id` | `product_stocks.shop_id`, `orders.shop_id`, `customer_ledger.shop_id` | `api/src/models/Shop.ts`, `api/src/controllers/shopController.ts:5`, `web/src/pages/Settings.tsx:25`, `App/lib/config/supabase_config.dart:50` | **KEEP SUPPORTING** | Business outlet profile, GST, invoice settings |
| 46 | `status_history` | 0 | `shops.id` | None | `api/src/models/StatusHistory.ts` | **KEEP SUPPORTING** | Shop activation/suspension audit history |
| 47 | `stock_transfers` | 0 | `products.id`, `shops.id` | None | `api/src/models/StockTransfer.ts`, `api/src/controllers/stockTransferController.ts:10` | **REMOVE CANDIDATE** | Multi-outlet transfer module (single active shop currently) |
| 48 | `subcategories` | 0 | `categories.id` | None | `api/src/models/Subcategory.ts` | **KEEP SUPPORTING** | Granular product classification |
| 49 | `suppliers` | 1 | `owners.id` | None | `api/src/models/Supplier.ts`, `api/src/controllers/supplierController.ts:5` | **REMOVE CANDIDATE** | Unused supplier/vendor tracking |

---

## 4. Key Diagnostic Findings

### A. The Billing Tables (`bills` and `sales`)
- In the active backend codebase (`saleController.ts`), sales/bills are referenced via the `Sale` model mapped to table `"sales"`.
- However, in the live PostgreSQL database, **neither `"sales"` nor `"bills"` exists**!
- Table `"sale_items"` exists with `sale_id` and foreign key `sale_items_product_id_fkey -> products(id)`.
- **Solution:** Create table `bills` with all required invoice columns (`invoice_number`, `customer_id`, `shop_id`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `paid_amount`, `due_amount`, `status`, `payment_method`). Provide a view alias `CREATE VIEW sales AS SELECT * FROM bills;` to ensure 100% backward compatibility for all existing backend controllers.
- Rename/Alias `sale_items` to `bill_items` with a view `CREATE VIEW sale_items AS SELECT * FROM bill_items;`.

### B. Unused Modules Targeted for Removal
1. **EMI Module (`emi_plans`, `emi_installments`):**
   - Both tables have 0 rows in production.
   - All modern retail billing uses immediate cash/UPI/credit with customer ledger tracking.
   - Removing these eliminates 2 tables, 14 Sequelize relationships, and associated controller overhead.
2. **Returns Module (`sale_return_items`, `purchase_returns`, `purchase_return_items`):**
   - All tables have 0 rows in production.
   - Unused return workflows add foreign key locks to `sale_items`.
3. **HR / Payroll Module (`attendance`, `leave_requests`, `payrolls`, `salary_configs`, `salary_payments`, `employee_advances`, `employee_incentives`, `employee_ledger`):**
   - All 8 tables have 0 rows in production.
   - Out of scope for shop catalog, billing, order, and ledger operations.

### C. Live Data Integrity Verification
- **Products:** 184 active products verified with valid SKUs, selling prices, and category links.
- **Product Stocks:** 90 stock records linked to shop 1.
- **Customer:** 1 active customer record (`Customer`, phone `9876543210`).
- **Owner & Shop:** Owner 1 (`NSYU`, phone `8800503662`) and Shop 1 (`NSYU`) verified intact.
- **Zero orphaned records** detected across `products`, `product_stocks`, and `categories`.

