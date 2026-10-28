"use strict";
/**
 * Central registry of everything the permission system knows about.
 * Add a new module here the day you add a new business module
 * (e.g. "inventory", "sales") — the seed script and middleware
 * both read from this list, so nothing else needs to change.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_ROLES = exports.SENSITIVE_FIELDS = exports.ACTIONS = exports.MODULES = void 0;
// Every screen/module an employee could be granted access to
exports.MODULES = [
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
];
// Standard CRUD-style actions available per module
exports.ACTIONS = ["view", "create", "edit", "delete"];
// Sensitive data fields that can be independently hidden/shown
// regardless of whether the employee can "view" the parent module
exports.SENSITIVE_FIELDS = [
    "purchase_price",
    "selling_price",
    "profit",
    "supplier",
    "customer_outstanding",
    "emi",
    "salary",
];
// Built-in system roles created automatically for every new owner.
// "Owner" always has every permission and cannot be edited/deleted.
exports.SYSTEM_ROLES = [
    "Owner",
    "Manager",
    "Sales Staff",
    "Billing Staff",
    "Inventory Staff",
    "Accountant",
];
//# sourceMappingURL=permissions.js.map