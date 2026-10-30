"use strict";
/**
 * Central registry of RBAC modules, permissions, and roles.
 * All modules and permissions are dynamically backed by database tables:
 * - modules
 * - permissions
 * - roles
 * - role_permissions
 * - shop_modules
 * - user_roles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_ROLE_CODES = exports.SYSTEM_ROLES = exports.SENSITIVE_FIELDS = exports.ACTIONS = exports.MODULE_ALIASES = exports.MODULES = exports.CORE_MODULES = void 0;
exports.toCanonicalModule = toCanonicalModule;
// The 14 standardized system modules
exports.CORE_MODULES = [
    "all_shops",
    "shop_settings",
    "user_management",
    "role_permissions",
    "products",
    "stock_management",
    "billing",
    "sales_purchases",
    "customers",
    "orders",
    "accounts_expenses",
    "reports",
    "subscriptions",
    "system_settings",
];
// Legacy + Core module names accepted by permission middleware
exports.MODULES = [
    ...exports.CORE_MODULES,
    "dashboard",
    "shops",
    "inventory",
    "purchase",
    "sales",
    "suppliers",
    "payments",
    "ledger",
    "emi",
    "employees",
    "attendance",
    "leave",
    "payroll",
    "settings",
];
// Module aliases for canonical mapping
exports.MODULE_ALIASES = {
    all_shops: "all_shops",
    shops: "all_shops",
    shop_settings: "shop_settings",
    settings: "shop_settings",
    user_management: "user_management",
    employees: "user_management",
    attendance: "user_management",
    leave: "user_management",
    role_permissions: "role_permissions",
    roles: "role_permissions",
    products: "products",
    stock_management: "stock_management",
    inventory: "stock_management",
    billing: "billing",
    sales_purchases: "sales_purchases",
    sales: "sales_purchases",
    purchase: "sales_purchases",
    customers: "customers",
    orders: "orders",
    accounts_expenses: "accounts_expenses",
    payments: "accounts_expenses",
    ledger: "accounts_expenses",
    emi: "accounts_expenses",
    payroll: "accounts_expenses",
    suppliers: "accounts_expenses",
    reports: "reports",
    subscriptions: "subscriptions",
    system_settings: "system_settings",
    dashboard: "reports",
};
function toCanonicalModule(mod) {
    return exports.MODULE_ALIASES[mod] || mod;
}
// Standard CRUD actions
exports.ACTIONS = ["view", "create", "edit", "delete"];
// Sensitive fields
exports.SENSITIVE_FIELDS = [
    "purchase_price",
    "selling_price",
    "profit",
    "supplier",
    "customer_outstanding",
    "emi",
    "salary",
];
// The 4 standardized roles
exports.SYSTEM_ROLES = [
    "Super Admin",
    "Owner",
    "Staff",
    "User",
];
exports.SYSTEM_ROLE_CODES = [
    "super_admin",
    "owner",
    "staff",
    "user",
];
//# sourceMappingURL=permissions.js.map