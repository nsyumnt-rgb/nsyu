import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import RequireCustomerAuth from "./components/RequireCustomerAuth";
import RequireSuperAdmin from "./components/RequireSuperAdmin";
import DashboardLayout from "./layouts/DashboardLayout";
import CustomerPortalLayout from "./layouts/CustomerPortalLayout";
import MarketLayout from "./layouts/MarketLayout";
import AdminLayout from "./layouts/AdminLayout";
import { RedirectWithQuery } from "./components/PageTabs";

/* Lazy-loaded Pages */
// Market Pages (Customer B2C Ordering)
const MarketHome = lazy(() => import("./pages/market/MarketHome"));
const MarketSearch = lazy(() => import("./pages/market/MarketSearch"));
const MarketShops = lazy(() => import("./pages/market/MarketShops"));
const MarketShop = lazy(() => import("./pages/market/MarketShop"));
const MarketProduct = lazy(() => import("./pages/market/MarketProduct"));
const MarketCart = lazy(() => import("./pages/market/MarketCart"));
const MarketCheckout = lazy(() => import("./pages/market/MarketCheckout"));

// Auth Pages (3 Roles: Super Admin, Owner, Customer)
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const SelectShop = lazy(() => import("./pages/SelectShop"));

// 6 Core Modules for Shop Owner: Bill, Ledger, Inventory, Customer, Product, Order
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductsHub = lazy(() => import("./pages/ProductsHub"));
const ProductDetail = lazy(() => import("./pages/details/ProductDetail"));
const InventoryOverview = lazy(() => import("./pages/InventoryOverview"));
const Billing = lazy(() => import("./pages/Billing"));
const Sales = lazy(() => import("./pages/Sales"));
const SaleDetail = lazy(() => import("./pages/details/SaleDetail"));
const Orders = lazy(() => import("./pages/Orders"));
const CustomersHub = lazy(() => import("./pages/CustomersHub"));
const CustomerDetail = lazy(() => import("./pages/details/CustomerDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Customer Portal Pages
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalStore = lazy(() => import("./pages/portal/PortalStore"));
const PortalCatalog = lazy(() => import("./pages/portal/PortalCatalog"));
const PortalProduct = lazy(() => import("./pages/portal/PortalProduct"));
const PortalCart = lazy(() => import("./pages/portal/PortalCart"));
const PortalOrders = lazy(() => import("./pages/portal/PortalOrders"));
const PortalOrderDetail = lazy(() => import("./pages/portal/PortalOrderDetail"));
const PortalBills = lazy(() => import("./pages/portal/PortalBills"));
const PortalBillDetail = lazy(() => import("./pages/portal/PortalBillDetail"));
const PortalLedger = lazy(() => import("./pages/portal/PortalLedger"));
const PortalProfile = lazy(() => import("./pages/portal/PortalProfile"));

// Super Admin Pages (Role 1: Manage all shops)
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminShops = lazy(() => import("./pages/admin/AdminShops"));
const AdminOwners = lazy(() => import("./pages/admin/AdminOwners"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminShopView = lazy(() => import("./pages/admin/AdminShopView"));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="relative w-10 h-10">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 animate-ping absolute inset-0" />
        <div className="w-10 h-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500 tracking-wide">Loading view...</p>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ───────────────────────────────────────────────────────────── */}
          {/* ROLE 3: CUSTOMER — Public Marketplace & Ordering             */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Route element={<MarketLayout />}>
            <Route path="/" element={<MarketHome />} />
            <Route path="/categories" element={<Navigate to="/market/search" replace />} />
            <Route path="/market/search" element={<MarketSearch />} />
            <Route path="/market/shops" element={<MarketShops />} />
            <Route path="/market/shop/:code" element={<MarketShop />} />
            <Route path="/market/p/:shopId/:productId" element={<MarketProduct />} />
            <Route path="/market/cart" element={<MarketCart />} />
            <Route path="/market/checkout" element={<MarketCheckout />} />
          </Route>

          {/* Single Unified Login & Registration */}
          <Route path="/login" element={<Login />} />
          <Route path="/portal/login" element={<Navigate to="/login?tab=customer" replace />} />
          <Route path="/register" element={<Register />} />

          {/* Customer Authenticated Portal */}
          <Route element={<RequireCustomerAuth />}>
            <Route path="/portal" element={<CustomerPortalLayout />}>
              <Route index element={<Navigate to="/portal/home" replace />} />
              <Route path="home" element={<PortalStore />} />
              <Route path="account" element={<PortalHome />} />
              <Route path="catalog" element={<PortalCatalog />} />
              <Route path="product/:id" element={<PortalProduct />} />
              <Route path="cart" element={<PortalCart />} />
              <Route path="orders" element={<PortalOrders />} />
              <Route path="orders/:id" element={<PortalOrderDetail />} />
              <Route path="bills" element={<PortalBills />} />
              <Route path="bills/:id" element={<PortalBillDetail />} />
              <Route path="ledger" element={<PortalLedger />} />
              <Route path="profile" element={<PortalProfile />} />
            </Route>
          </Route>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ROLE 1: SUPER ADMIN — Manage All Shops                        */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="shops" element={<AdminShops />} />
              <Route path="owners" element={<AdminOwners />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="support" element={<AdminShopView />} />
            </Route>
          </Route>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ROLE 2: OWNER — Manage Own Shop (6 Modules: Bill, Ledger,     */}
          {/* Inventory, Customer, Product, Order)                          */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Route element={<RequireAuth />}>
            <Route path="/select-shop" element={<SelectShop />} />

            <Route path="/app" element={<DashboardLayout />}>
              {/* ── Main menu ─────────────────────────────────────────── */}
              <Route index element={<Dashboard />} />
              <Route path="billing" element={<Billing />} />
              <Route path="sales" element={<Sales />} />
              <Route path="sales/:id" element={<SaleDetail />} />
              {/* Products page: Products | Categories tabs */}
              <Route path="products" element={<ProductsHub />} />
              <Route path="products/:id" element={<ProductDetail />} />
              {/* Customers page: Details | Ledger tabs */}
              <Route path="customers" element={<CustomersHub />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              {/* Settings: shop profile, inventory, preferences, … */}
              <Route path="settings" element={<Settings />} />
              <Route path="settings/:section" element={<Settings />} />

              {/* Orders: hidden from the menu (FEATURES.showOrdersMenu) but still routable */}
              <Route path="orders" element={<Orders />} />
              <Route path="inventory/overview" element={<InventoryOverview />} />

              {/* ── Old links → their new home (query string kept) ─────── */}
              <Route path="categories" element={<RedirectWithQuery to="/app/products" params={{ tab: "categories" }} />} />
              <Route path="catalog" element={<Navigate to="/app/products" replace />} />
              <Route path="ledger" element={<RedirectWithQuery to="/app/customers" params={{ tab: "ledger" }} />} />
              <Route path="khata" element={<RedirectWithQuery to="/app/customers" params={{ tab: "ledger" }} />} />
              <Route path="payments" element={<RedirectWithQuery to="/app/customers" params={{ tab: "ledger" }} />} />
              <Route path="payments/:id" element={<Navigate to="/app/customers?tab=ledger" replace />} />
              <Route path="expenses" element={<Navigate to="/app/customers?tab=ledger" replace />} />
              <Route path="cart" element={<Navigate to="/app/billing?cart=1" replace />} />
              <Route path="inventory" element={<Navigate to="/app/settings/inventory" replace />} />
              <Route path="inventory/manage" element={<Navigate to="/app/settings/inventory" replace />} />
              <Route path="low-stock" element={<Navigate to="/app/settings/inventory" replace />} />
              <Route path="purchase" element={<Navigate to="/app/settings/inventory" replace />} />
              <Route path="purchase/:id" element={<Navigate to="/app/settings/inventory" replace />} />
              <Route path="suppliers" element={<Navigate to="/app/settings/inventory" replace />} />
              <Route path="suppliers/:id" element={<Navigate to="/app/settings/inventory" replace />} />
              <Route path="shops" element={<Navigate to="/app/settings/shop" replace />} />
              <Route path="reports" element={<Navigate to="/app" replace />} />
              <Route path="roles" element={<Navigate to="/app/settings" replace />} />
              <Route path="staff" element={<Navigate to="/app/settings" replace />} />
            </Route>
          </Route>

          {/* 404 Catch All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
