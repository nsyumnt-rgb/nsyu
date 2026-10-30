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

// The 14 standardized system modules
export const CORE_MODULES = [
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
] as const;

export type CoreModuleName = (typeof CORE_MODULES)[number];

// Legacy + Core module names accepted by permission middleware
export const MODULES = [
  ...CORE_MODULES,
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
] as const;

export type ModuleName = (typeof MODULES)[number];

// Module aliases for canonical mapping
export const MODULE_ALIASES: Record<string, CoreModuleName> = {
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

export function toCanonicalModule(mod: string): CoreModuleName {
  return MODULE_ALIASES[mod] || (mod as CoreModuleName);
}

// Standard CRUD actions
export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type ActionName = (typeof ACTIONS)[number];

// Sensitive fields
export const SENSITIVE_FIELDS = [
  "purchase_price",
  "selling_price",
  "profit",
  "supplier",
  "customer_outstanding",
  "emi",
  "salary",
] as const;

export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

// The 4 standardized roles
export const SYSTEM_ROLES = [
  "Super Admin",
  "Owner",
  "Staff",
  "User",
] as const;

export const SYSTEM_ROLE_CODES = [
  "super_admin",
  "owner",
  "staff",
  "user",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];
