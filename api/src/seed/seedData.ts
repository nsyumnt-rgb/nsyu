/**
 * Pure data — no DB calls here. seed.ts reads these and creates rows.
 * Kept separate so the "what demo data looks like" is easy to skim
 * and tweak without touching the seeding/idempotency logic.
 */

export const DEMO_MARKER_EMAIL = "demo.owner@nsyu.local";

export const DEMO_OWNER = {
  name: "NSYU Demo Owner",
  email: DEMO_MARKER_EMAIL,
  password: "Demo@12345",
};

export const DEMO_SHOPS = [
  { name: "NSYU Main Store", code: "NSYU-MAIN", address: "Ghaziabad, Uttar Pradesh", phone: "9810000001" },
  { name: "NSYU Branch Store", code: "NSYU-BRANCH", address: "Noida, Sector 18, Uttar Pradesh", phone: "9810000002" },
];

export const DEMO_EMPLOYEES = [
  {
    name: "Demo Manager",
    email: "manager@nsyu.local",
    password: "Manager@12345",
    role: "Manager",
    shopCodes: ["NSYU-MAIN"],
  },
  {
    name: "Demo Sales Staff",
    email: "sales@nsyu.local",
    password: "Sales@12345",
    role: "Sales Staff",
    shopCodes: ["NSYU-MAIN", "NSYU-BRANCH"],
  },
  {
    name: "Demo Inventory Staff",
    email: "inventory@nsyu.local",
    password: "Inventory@12345",
    role: "Inventory Staff",
    shopCodes: ["NSYU-MAIN"],
  },
  {
    name: "Demo Accountant",
    email: "accountant@nsyu.local",
    password: "Accountant@12345",
    role: "Accountant",
    shopCodes: ["NSYU-MAIN"],
  },
];
// Note: the spec suggested an "HR Staff" role too. This project's system
// roles (config/permissions.ts SYSTEM_ROLES) are Owner/Manager/Sales
// Staff/Billing Staff/Inventory Staff/Accountant — adding a brand new
// system role is a real schema/permissions-surface change, so rather
// than do that silently inside a demo-data script, demo employees are
// assigned to the existing roles only. Add "HR Staff" via config/permissions.ts
// + utils/seed.ts's DEFAULT_MODULE_ACCESS first if you want it seeded too.

export const DEMO_CATEGORIES: { name: string; subcategories: string[] }[] = [
  { name: "Mobile Accessories", subcategories: ["Chargers", "Cables"] },
  { name: "Audio", subcategories: ["Earphones", "Bluetooth Accessories"] },
  { name: "Power", subcategories: ["Power Banks"] },
  { name: "Cases & Covers", subcategories: [] },
  { name: "Tempered Glass", subcategories: [] },
];

export const DEMO_SUPPLIERS = [
  { name: "Demo Accessories Supplier", phone: "9820000001", email: "supplier1@nsyu.local", address: "Karol Bagh, Delhi" },
  { name: "Delhi Mobile Wholesale", phone: "9820000002", email: "supplier2@nsyu.local", address: "Gaffar Market, Delhi" },
  { name: "Tech Distribution India", phone: "9820000003", email: "supplier3@nsyu.local", address: "Nehru Place, Delhi" },
  { name: "Smart Accessories Hub", phone: "9820000004", email: "supplier4@nsyu.local", address: "Lajpat Nagar, Delhi" },
  { name: "Mobile Parts Supplier", phone: "9820000005", email: "supplier5@nsyu.local", address: "Ghaziabad, UP" },
];

/**
 * category/subcategory are matched by name against DEMO_CATEGORIES
 * above. supplierIndex indexes into DEMO_SUPPLIERS. Opening stock is
 * [mainStoreQty, branchStoreQty].
 */
export const DEMO_PRODUCTS = [
  { name: "USB-C Fast Charger 25W", sku: "NSYU-CHG-025W", category: "Mobile Accessories", subcategory: "Chargers", supplierIndex: 0, purchase: 350, selling: 599, mrp: 799, minStock: 10, stock: [50, 20] },
  { name: "USB-C Fast Charger 33W", sku: "NSYU-CHG-033W", category: "Mobile Accessories", subcategory: "Chargers", supplierIndex: 0, purchase: 450, selling: 799, mrp: 999, minStock: 10, stock: [35, 15] },
  { name: "iPhone Lightning Cable", sku: "NSYU-CBL-LGT", category: "Mobile Accessories", subcategory: "Cables", supplierIndex: 1, purchase: 150, selling: 349, mrp: 499, minStock: 20, stock: [60, 30] },
  { name: "USB-C to USB-C Cable", sku: "NSYU-CBL-CTC", category: "Mobile Accessories", subcategory: "Cables", supplierIndex: 1, purchase: 120, selling: 299, mrp: 399, minStock: 20, stock: [100, 40] },
  { name: "Micro USB Cable", sku: "NSYU-CBL-MCR", category: "Mobile Accessories", subcategory: "Cables", supplierIndex: 1, purchase: 80, selling: 199, mrp: 249, minStock: 20, stock: [70, 25] },
  { name: "Type-C Earphones", sku: "NSYU-AUD-TCE", category: "Audio", subcategory: "Earphones", supplierIndex: 2, purchase: 200, selling: 449, mrp: 599, minStock: 15, stock: [25, 10] },
  { name: "Bluetooth Earbuds", sku: "NSYU-AUD-BTE", category: "Audio", subcategory: "Bluetooth Accessories", supplierIndex: 2, purchase: 600, selling: 1299, mrp: 1699, minStock: 10, stock: [20, 8] },
  { name: "Wireless Neckband", sku: "NSYU-AUD-NCK", category: "Audio", subcategory: "Bluetooth Accessories", supplierIndex: 2, purchase: 450, selling: 899, mrp: 1199, minStock: 10, stock: [18, 6] },
  { name: "10000mAh Power Bank", sku: "NSYU-PWR-010K", category: "Power", subcategory: "Power Banks", supplierIndex: 3, purchase: 700, selling: 1299, mrp: 1599, minStock: 8, stock: [30, 12] },
  { name: "20000mAh Power Bank", sku: "NSYU-PWR-020K", category: "Power", subcategory: "Power Banks", supplierIndex: 3, purchase: 1100, selling: 1999, mrp: 2499, minStock: 8, stock: [15, 5] },
  { name: "iPhone 15 Case", sku: "NSYU-CSE-IP15", category: "Cases & Covers", subcategory: null, supplierIndex: 4, purchase: 90, selling: 249, mrp: 349, minStock: 15, stock: [40, 15] },
  { name: "iPhone 16 Case", sku: "NSYU-CSE-IP16", category: "Cases & Covers", subcategory: null, supplierIndex: 4, purchase: 100, selling: 279, mrp: 379, minStock: 15, stock: [35, 12] },
  { name: "Samsung A55 Case", sku: "NSYU-CSE-SGA55", category: "Cases & Covers", subcategory: null, supplierIndex: 4, purchase: 80, selling: 229, mrp: 299, minStock: 15, stock: [30, 10] },
  { name: "Redmi Note 14 Case", sku: "NSYU-CSE-RN14", category: "Cases & Covers", subcategory: null, supplierIndex: 4, purchase: 70, selling: 199, mrp: 269, minStock: 15, stock: [30, 10] },
  { name: "Tempered Glass", sku: "NSYU-TG-UNI", category: "Tempered Glass", subcategory: null, supplierIndex: 4, purchase: 40, selling: 149, mrp: 199, minStock: 30, stock: [150, 60] },
  { name: "Wireless Charger", sku: "NSYU-CHG-WRL", category: "Mobile Accessories", subcategory: "Chargers", supplierIndex: 0, purchase: 400, selling: 899, mrp: 1199, minStock: 10, stock: [20, 8] },
  { name: "Car Charger", sku: "NSYU-CHG-CAR", category: "Mobile Accessories", subcategory: "Chargers", supplierIndex: 0, purchase: 150, selling: 349, mrp: 449, minStock: 10, stock: [25, 10] },
  { name: "Mobile Holder", sku: "NSYU-ACC-HLD", category: "Mobile Accessories", subcategory: null, supplierIndex: 3, purchase: 80, selling: 199, mrp: 279, minStock: 15, stock: [40, 15] },
  { name: "Bluetooth Speaker", sku: "NSYU-AUD-SPK", category: "Audio", subcategory: "Bluetooth Accessories", supplierIndex: 2, purchase: 500, selling: 999, mrp: 1299, minStock: 10, stock: [15, 5] },
  { name: "OTG Adapter", sku: "NSYU-ACC-OTG", category: "Mobile Accessories", subcategory: null, supplierIndex: 1, purchase: 40, selling: 129, mrp: 179, minStock: 20, stock: [50, 20] },
];

export const DEMO_CUSTOMERS = Array.from({ length: 10 }, (_, i) => ({
  name: `Demo Customer ${String(i + 1).padStart(2, "0")}`,
  phone: `98100${String(10 + i).padStart(5, "0")}`,
  email: `customer${i + 1}@nsyu.local`,
  address: i % 2 === 0 ? "Ghaziabad, UP" : "Delhi",
}));
