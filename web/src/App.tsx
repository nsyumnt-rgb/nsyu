import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import RequireCustomerAuth from "./components/RequireCustomerAuth";
import RequireSuperAdmin from "./components/RequireSuperAdmin";
import DashboardLayout from "./layouts/DashboardLayout";
import CustomerPortalLayout from "./layouts/CustomerPortalLayout";
import MarketLayout from "./layouts/MarketLayout";
import AdminLayout from "./layouts/AdminLayout";

/* Lazy-loaded Pages */
// Market Pages
const MarketHome = lazy(() => import("./pages/market/MarketHome"));
const MarketSearch = lazy(() => import("./pages/market/MarketSearch"));
const MarketShops = lazy(() => import("./pages/market/MarketShops"));
const MarketShop = lazy(() => import("./pages/market/MarketShop"));
const MarketProduct = lazy(() => import("./pages/market/MarketProduct"));
const MarketCart = lazy(() => import("./pages/market/MarketCart"));
const MarketCheckout = lazy(() => import("./pages/market/MarketCheckout"));

// Auth & Setup Pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const SelectShop = lazy(() => import("./pages/SelectShop"));

// Staff & Admin App Pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Shops = lazy(() => import("./pages/Shops"));
const Roles = lazy(() => import("./pages/Roles"));
const Staff = lazy(() => import("./pages/Staff"));
const Products = lazy(() => import("./pages/Products"));
const Catalog = lazy(() => import("./pages/Catalog"));
const Inventory = lazy(() => import("./pages/Inventory"));
const InventoryOverview = lazy(() => import("./pages/InventoryOverview"));
const Purchase = lazy(() => import("./pages/Purchase"));
const Sales = lazy(() => import("./pages/Sales"));
const Orders = lazy(() => import("./pages/Orders"));
const SalesHub = lazy(() => import("./pages/SalesHub"));
const Customers = lazy(() => import("./pages/Customers"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Ledger = lazy(() => import("./pages/Ledger"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Detail Pages
const SaleDetail = lazy(() => import("./pages/details/SaleDetail"));
const PurchaseDetail = lazy(() => import("./pages/details/PurchaseDetail"));
const CustomerDetail = lazy(() => import("./pages/details/CustomerDetail"));
const SupplierDetail = lazy(() => import("./pages/details/SupplierDetail"));
const ProductDetail = lazy(() => import("./pages/details/ProductDetail"));
const TransferDetail = lazy(() => import("./pages/details/TransferDetail"));
const MovementDetail = lazy(() => import("./pages/details/MovementDetail"));

// Customer Portal Pages
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalStore = lazy(() => import("./pages/portal/PortalStore"));
const PortalWishlist = lazy(() => import("./pages/portal/PortalWishlist"));
const PortalCatalog = lazy(() => import("./pages/portal/PortalCatalog"));
const PortalProduct = lazy(() => import("./pages/portal/PortalProduct"));
const PortalCart = lazy(() => import("./pages/portal/PortalCart"));
const PortalOrders = lazy(() => import("./pages/portal/PortalOrders"));
const PortalOrderDetail = lazy(() => import("./pages/portal/PortalOrderDetail"));
const PortalBills = lazy(() => import("./pages/portal/PortalBills"));
const PortalBillDetail = lazy(() => import("./pages/portal/PortalBillDetail"));
const PortalLedger = lazy(() => import("./pages/portal/PortalLedger"));
const PortalNotifications = lazy(() => import("./pages/portal/PortalNotifications"));
const PortalProfile = lazy(() => import("./pages/portal/PortalProfile"));

// Super Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminShops = lazy(() => import("./pages/admin/AdminShops"));
const AdminOwners = lazy(() => import("./pages/admin/AdminOwners"));
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
          {/* Public marketplace (MultiShop phase 1) — no login required */}
          <Route element={<MarketLayout />}>
            <Route path="/" element={<MarketHome />} />
            <Route path="/market/search" element={<MarketSearch />} />
            <Route path="/market/shops" element={<MarketShops />} />
            <Route path="/market/shop/:code" element={<MarketShop />} />
            <Route path="/market/p/:shopId/:productId" element={<MarketProduct />} />
            <Route path="/market/cart" element={<MarketCart />} />
            <Route path="/market/checkout" element={<MarketCheckout />} />
          </Route>
          {/* Single Unified Login Page */}
          <Route path="/login" element={<Login />} />
          <Route path="/portal/login" element={<Navigate to="/login?tab=customer" replace />} />
          <Route path="/register" element={<Register />} />
          <Route element={<RequireCustomerAuth />}>
            <Route path="/portal" element={<CustomerPortalLayout />}>
              <Route index element={<Navigate to="/portal/home" replace />} />
              <Route path="home" element={<PortalStore />} />
              <Route path="account" element={<PortalHome />} />
              <Route path="wishlist" element={<PortalWishlist />} />
              <Route path="catalog" element={<PortalCatalog />} />
              <Route path="product/:id" element={<PortalProduct />} />
              <Route path="cart" element={<PortalCart />} />
              <Route path="orders" element={<PortalOrders />} />
              <Route path="orders/:id" element={<PortalOrderDetail />} />
              <Route path="bills" element={<PortalBills />} />
              <Route path="bills/:id" element={<PortalBillDetail />} />
              <Route path="ledger" element={<PortalLedger />} />
              <Route path="notifications" element={<PortalNotifications />} />
              <Route path="profile" element={<PortalProfile />} />
            </Route>
          </Route>

          {/* Super Admin Routes (Web Only) */}
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="shops" element={<AdminShops />} />
              <Route path="owners" element={<AdminOwners />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="support" element={<AdminShopView />} />
            </Route>
          </Route>

          {/* Staff/Admin App Routes */}
          <Route element={<RequireAuth />}>
            <Route path="/select-shop" element={<SelectShop />} />

            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductDetail />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="inventory/overview" element={<InventoryOverview />} />
              <Route path="inventory/manage" element={<Inventory />} />
              <Route path="inventory/transfers/:id" element={<TransferDetail />} />
              <Route path="inventory/movements/:id" element={<MovementDetail />} />
              <Route path="purchase" element={<Purchase />} />
              <Route path="purchase/:id" element={<PurchaseDetail />} />
              <Route path="sales" element={<Sales />} />
              <Route path="sales/:id" element={<SaleDetail />} />
              <Route path="orders" element={<Orders />} />
              <Route path="billing" element={<SalesHub />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/:id" element={<SupplierDetail />} />
              <Route path="payments" element={<Navigate to="/app/ledger" replace />} />
              <Route path="payments/:id" element={<Navigate to="/app/ledger" replace />} />
              <Route path="ledger" element={<Ledger />} />
              <Route path="shops" element={<Shops />} />
              <Route path="roles" element={<Roles />} />
              <Route path="staff" element={<Staff />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
