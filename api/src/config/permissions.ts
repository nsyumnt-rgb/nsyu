/**
 * Central registry of everything the permission system knows about.
 * Add a new module here the day you add a new business module
 * (e.g. "inventory", "sales") — the seed script and middleware
 * both read from this list, so nothing else needs to change.
 */

// Every screen/module an employee could be granted access to
export const MODULES = [
  "dashboard",
  "shops",
  "products",
  "inventory",
  "purchase",
  "sales",
  "billing",
  "customers",
  "suppliers",
  "payments",
  "ledger",
  "emi",
  "employees",
  "attendance",
  "leave",
  "payroll",
  "reports",
  "settings",
] as const;

export type ModuleName = (typeof MODULES)[number];

// Standard CRUD-style actions available per module
export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type ActionName = (typeof ACTIONS)[number];

// Sensitive data fields that can be independently hidden/shown
// regardless of whether the employee can "view" the parent module
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

// Built-in system roles created automatically for every new owner.
// "Owner" always has every permission and cannot be edited/deleted.
export const SYSTEM_ROLES = [
  "Owner",
  "Manager",
  "Sales Staff",
  "Billing Staff",
  "Inventory Staff",
  "Accountant",
] as const;
