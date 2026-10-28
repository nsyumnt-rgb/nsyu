import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import DashboardLayout from "./layouts/DashboardLayout";

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

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Everything below requires a session; RequireAuth also
            resolves /auth/me and redirects employees without an
            active shop to /select-shop. */}
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
