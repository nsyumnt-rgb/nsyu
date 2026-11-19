import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import RequireCustomerAuth from "./components/RequireCustomerAuth";
import DashboardLayout from "./layouts/DashboardLayout";
import CustomerPortalLayout from "./layouts/CustomerPortalLayout";
import MarketLayout from "./layouts/MarketLayout";
import MarketHome from "./pages/market/MarketHome";
import MarketSearch from "./pages/market/MarketSearch";
import MarketShops from "./pages/market/MarketShops";
import MarketShop from "./pages/market/MarketShop";
import MarketProduct from "./pages/market/MarketProduct";
import MarketCart from "./pages/market/MarketCart";
import MarketCheckout from "./pages/market/MarketCheckout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import SelectShop from "./pages/SelectShop";
import Dashboard from "./pages/Dashboard";
import Shops from "./pages/Shops";
import Roles from "./pages/Roles";
import Staff from "./pages/Staff";
import Products from "./pages/Products";
import Catalog from "./pages/Catalog";
import Inventory from "./pages/Inventory";
import InventoryOverview from "./pages/InventoryOverview";
import Purchase from "./pages/Purchase";
import Sales from "./pages/Sales";
import Orders from "./pages/Orders";
import SalesHub from "./pages/SalesHub";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Ledger from "./pages/Ledger";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

import SaleDetail from "./pages/details/SaleDetail";
import PurchaseDetail from "./pages/details/PurchaseDetail";
import CustomerDetail from "./pages/details/CustomerDetail";
import SupplierDetail from "./pages/details/SupplierDetail";
import ProductDetail from "./pages/details/ProductDetail";
import TransferDetail from "./pages/details/TransferDetail";
import MovementDetail from "./pages/details/MovementDetail";

/* Customer Portal Pages */
import PortalLogin from "./pages/portal/PortalLogin";
import PortalHome from "./pages/portal/PortalHome";
import PortalStore from "./pages/portal/PortalStore";
import PortalWishlist from "./pages/portal/PortalWishlist";
import PortalCatalog from "./pages/portal/PortalCatalog";
import PortalProduct from "./pages/portal/PortalProduct";
import PortalCart from "./pages/portal/PortalCart";
import PortalOrders from "./pages/portal/PortalOrders";
import PortalOrderDetail from "./pages/portal/PortalOrderDetail";
import PortalBills from "./pages/portal/PortalBills";
import PortalBillDetail from "./pages/portal/PortalBillDetail";
import PortalLedger from "./pages/portal/PortalLedger";
import PortalNotifications from "./pages/portal/PortalNotifications";
import PortalProfile from "./pages/portal/PortalProfile";

/* Super Admin Panel (Web Only) */
import RequireSuperAdmin from "./components/RequireSuperAdmin";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminShops from "./pages/admin/AdminShops";
import AdminOwners from "./pages/admin/AdminOwners";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminShopView from "./pages/admin/AdminShopView";

export default function App() {
  return (
    <HashRouter>
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
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Customer Portal Auth & App Routes */}
        <Route path="/portal/login" element={<PortalLogin />} />
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
    </HashRouter>
  );
}
