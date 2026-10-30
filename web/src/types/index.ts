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

// These mirror src/config/permissions.ts on the backend exactly.
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
  "payroll",
  "settings",
] as const;
export type ModuleName = (typeof MODULES)[number];

export interface ModuleItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
}

export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type ActionName = (typeof ACTIONS)[number];

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

export interface ModulePermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type PermissionGrid = Partial<Record<ModuleName, ModulePermission>>;
export type FieldGrid = Partial<Record<SensitiveField, boolean>>;

export interface Owner {
  id: number;
  name: string;
  email: string;
  phone?: string;
  status: "active" | "suspended";
}

export interface Employee {
  id: number;
  owner_id: number;
  name: string;
  email: string;
  phone?: string;
  status: "active" | "inactive";
  shopAssignments?: EmployeeShopAssignment[];
}

export interface EmployeeShopAssignment {
  id: number;
  employee_id: number;
  shop_id: number;
  role_id: number;
  shop?: Shop;
  role?: Role;
}

export interface Shop {
  id: number;
  owner_id: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  status: "active" | "inactive";
  roleId?: number;
  roleName?: string;
}

export interface Role {
  id: number;
  owner_id?: number | null;
  code?: string | null;
  name: string;
  description?: string | null;
  is_system: boolean;
  permissions?: Array<{ module: string; module_id?: number; scope?: string } & ModulePermission>;
  fieldPermissions?: Array<{ field: SensitiveField; allowed: boolean }>;
}

export interface ProductImage {
  id: number;
  product_id: number;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface Category {
  id: number;
  owner_id: number;
  name: string;
  status: "active" | "inactive";
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: number;
  owner_id: number;
  category_id: number;
  name: string;
  status: "active" | "inactive";
}

export interface Supplier {
  id: number;
  owner_id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  status: "active" | "inactive";
}

export interface ProductStockEntry {
  id: number;
  product_id: number;
  shop_id: number;
  current_stock: number;
  min_stock?: number | null;
  shop?: Shop;
}

// CHANGED: Product is now an owner-level catalog entry (no shop_id) —
// stock and location are tracked per shop separately. See api's
// models/Product.ts for the reasoning (stock transfers between shops
// require one catalog record, not a duplicated per-shop row).
export interface Product {
  id: number;
  owner_id: number;
  name: string;
  sku: string;
  barcode?: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  category?: Category;
  subcategory?: Subcategory;
  brand?: string;
  description?: string;
  purchase_price?: number; // omitted from response entirely if role can't view it
  selling_price: number;
  mrp: number;
  discount: number;
  tax_percent: number;
  min_stock: number;
  supplier_id?: number | null;
  supplier?: Supplier; // omitted entirely if role can't view it
  profit?: number; // present only if role can view it
  status: "active" | "inactive";
  images?: ProductImage[];
  stocks?: ProductStockEntry[]; // filtered to the active shop when browsing normally
  created_at?: string;
}

// Redacted shape returned by the public customer-facing endpoint —
// deliberately excludes purchase_price, profit, supplier, tax, min_stock.
export interface CustomerProduct {
  id: number;
  name: string;
  category: { id: number; name: string } | null;
  brand?: string;
  description?: string;
  images: ProductImage[];
  selling_price: number;
  mrp: number;
  discount: number;
  availability: boolean;
}

export const MOVEMENT_TYPES = [
  "opening",
  "purchase",
  "sale",
  "customer_return",
  "damage",
  "adjustment",
  "transfer_in",
  "transfer_out",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export interface InventoryTransaction {
  id: number;
  owner_id: number;
  shop_id: number;
  product_id: number;
  product?: { id: number; name: string; sku: string };
  type: MovementType;
  signed_quantity: number;
  balance_after: number;
  reference_type?: string | null;
  reference_id?: number | null;
  notes?: string | null;
  actor_type: "owner" | "employee";
  actor_id: number;
  created_at: string;
}

export interface StockTransfer {
  id: number;
  owner_id: number;
  product_id: number;
  from_shop_id: number;
  to_shop_id: number;
  quantity: number;
  notes?: string | null;
  created_at: string;
}

export interface ProductLocation {
  id: number;
  product_id: number;
  shop_id: number;
  shop?: Shop;
  rack?: string;
  shelf?: string;
  bin?: string;
  is_current: boolean;
  set_by_type: "owner" | "employee";
  set_by_id: number;
  created_at: string;
}

export type AccountType = "owner" | "employee";

export interface MeResponse {
  accountType: AccountType;
  owner?: Owner;
  employee?: Employee;
  shopId: number | null;
  roleId: number | null;
  roleName: string | null;
  assignedShopIds?: number[];
  permissions: PermissionGrid;
  fieldPermissions: FieldGrid;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface Customer {
  id: number;
  owner_id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  current_balance: number;
  status: "active" | "inactive";
  created_at?: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  returned_quantity: number;
  unit_price: number;
  rate?: number;
  discount_amount: number;
  tax_amount: number;
  tax_percent: number;
  total_amount: number;
  product?: Product;
}

export interface Sale {
  id: number;
  owner_id: number;
  shop_id: number;
  customer_id: number;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_method?: string;
  is_emi?: boolean;
  status: "paid" | "partially_paid" | "unpaid" | "cancelled" | "returned" | "partially_returned";
  notes?: string;
  customer?: Customer;
  shop?: Shop;
  items?: SaleItem[];
  payments?: any[];
  emiPlan?: any;
  returns?: any[];
  created_at?: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  returned_quantity: number;
  rate: number;
  discount_amount?: number;
  tax_amount: number;
  tax_percent: number;
  total_amount: number;
  product?: Product;
}

export interface Purchase {
  id: number;
  owner_id: number;
  shop_id: number;
  supplier_id: number;
  purchase_number: string;
  purchase_date: string;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_method?: string;
  status: "received" | "partially_paid" | "paid" | "cancelled" | "returned" | "partially_returned" | "unpaid";
  notes?: string;
  supplier?: Supplier;
  shop?: Shop;
  items?: PurchaseItem[];
  payments?: any[];
  returns?: any[];
  created_at?: string;
}

export interface CustomerLedgerEntry {
  id: number;
  owner_id: number;
  shop_id: number;
  customer_id: number;
  entry_type: "debit" | "credit";
  amount: number;
  reference_type: string;
  reference_id: number;
  description?: string;
  entry_date: string;
  status: "active" | "reversed";
  shop?: Shop;
}

export interface EMIInstallment {
  id: number;
  emi_plan_id: number;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  remaining_amount: number;
  late_fee: number;
  status: "Upcoming" | "Due" | "Overdue" | "Partially Paid" | "Paid" | "Cancelled";
  payment_date?: string;
  payment_method?: string;
}

export interface EMIPlan {
  id: number;
  owner_id: number;
  shop_id: number;
  customer_id: number;
  sale_id: number;
  principal_amount: number;
  down_payment: number;
  financed_amount: number;
  interest_rate_percent: number;
  tenure_months: number;
  total_payable: number;
  monthly_installment: number;
  outstanding_amount: number;
  status: "active" | "completed" | "defaulted" | "cancelled";
  customer?: Customer;
  sale?: Sale;
  shop?: Shop;
  installments?: EMIInstallment[];
}

export interface AttendanceRecord {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  date: string;
  check_in?: string;
  check_out?: string;
  working_hours?: number;
  overtime_hours?: number;
  status: "Present" | "Absent" | "Half Day" | "Leave" | "Holiday" | "Week Off";
  remarks?: string;
  employee?: Employee;
  shop?: Shop;
}

export interface PayrollRecord {
  id: number;
  owner_id: number;
  shop_id: number;
  employee_id: number;
  period_start: string;
  period_end: string;
  basic_component: number;
  allowances_component: number;
  overtime_amount: number;
  incentive_amount: number;
  gross_salary: number;
  deductions: number;
  advance_deduction: number;
  net_salary: number;
  paid_amount: number;
  due_amount: number;
  status: "draft" | "finalized" | "partially_paid" | "paid" | "cancelled";
  employee?: Employee;
  shop?: Shop;
  created_at?: string;
}
