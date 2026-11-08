import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import RequireCustomerAuth from "./components/RequireCustomerAuth";
import DashboardLayout from "./layouts/DashboardLayout";
import CustomerPortalLayout from "./layouts/CustomerPortalLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import SelectShop from "./pages/SelectShop";
import Dashboard from "./pages/Dashboard";
import Shops from "./pages/Shops";
import Employees from "./pages/Employees";
import Roles from "./pages/Roles";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Purchase from "./pages/Purchase";
import Sales from "./pages/Sales";
import Orders from "./pages/Orders";
import Billing from "./pages/Billing";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Payments from "./pages/Payments";
import Ledger from "./pages/Ledger";
import EMI from "./pages/EMI";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

import SaleDetail from "./pages/details/SaleDetail";
import PurchaseDetail from "./pages/details/PurchaseDetail";
import PaymentDetail from "./pages/details/PaymentDetail";
import CustomerDetail from "./pages/details/CustomerDetail";
import SupplierDetail from "./pages/details/SupplierDetail";
import ProductDetail from "./pages/details/ProductDetail";
import EmployeeDetail from "./pages/details/EmployeeDetail";
import TransferDetail from "./pages/details/TransferDetail";
import MovementDetail from "./pages/details/MovementDetail";
import EmiDetail from "./pages/details/EmiDetail";
import PayrollDetail from "./pages/details/PayrollDetail";

/* Customer Portal Pages */
import PortalLogin from "./pages/portal/PortalLogin";
import PortalHome from "./pages/portal/PortalHome";
import PortalCatalog from "./pages/portal/PortalCatalog";
import PortalCart from "./pages/portal/PortalCart";
import PortalOrders from "./pages/portal/PortalOrders";
import PortalOrderDetail from "./pages/portal/PortalOrderDetail";
import PortalBills from "./pages/portal/PortalBills";
import PortalBillDetail from "./pages/portal/PortalBillDetail";
import PortalLedger from "./pages/portal/PortalLedger";
import PortalNotifications from "./pages/portal/PortalNotifications";
import PortalProfile from "./pages/portal/PortalProfile";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Customer Portal Auth & App Routes */}
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route element={<RequireCustomerAuth />}>
          <Route path="/portal" element={<CustomerPortalLayout />}>
            <Route index element={<Navigate to="/portal/home" replace />} />
            <Route path="home" element={<PortalHome />} />
            <Route path="catalog" element={<PortalCatalog />} />
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

        {/* Staff/Admin App Routes */}
        <Route element={<RequireAuth />}>
          <Route path="/select-shop" element={<SelectShop />} />

          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="inventory/transfers/:id" element={<TransferDetail />} />
            <Route path="inventory/movements/:id" element={<MovementDetail />} />
            <Route path="purchase" element={<Purchase />} />
            <Route path="purchase/:id" element={<PurchaseDetail />} />
            <Route path="sales" element={<Sales />} />
            <Route path="sales/:id" element={<SaleDetail />} />
            <Route path="orders" element={<Orders />} />
            <Route path="billing" element={<Billing />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="suppliers/:id" element={<SupplierDetail />} />
            <Route path="payments" element={<Payments />} />
            <Route path="payments/:id" element={<PaymentDetail />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="emi" element={<EMI />} />
            <Route path="emi/:id" element={<EmiDetail />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/:id" element={<EmployeeDetail />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="payroll/:id" element={<PayrollDetail />} />
            <Route path="shops" element={<Shops />} />
            <Route path="roles" element={<Roles />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}
