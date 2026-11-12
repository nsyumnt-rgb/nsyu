import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCustomers, createCustomer, updateCustomerPortalAccess } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Customer } from "../types";

function CustomersInner() {
  const { can } = usePermission();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    shopName: "",
    phone: "",
    email: "",
    address: "",
    openingBalance: "0",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listCustomers({ search: search || undefined })
      .then((res) => setCustomers(res.data.data ?? []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load customers")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Customer Name is required");
      return;
    }

    const cleanPhone = form.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Mobile Number must be exactly 10 digits");
      return;
    }

    const cleanEmail = form.email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("A valid Email Address is required");
      return;
    }

    const address = form.address.trim();
    if (!address) {
      setError("Address is required");
      return;
    }

    const password = form.password.trim();
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const opBal = parseFloat(form.openingBalance) || 0;

    setSaving(true);
    try {
      await createCustomer({
        name,
        shopName: form.shopName.trim() || undefined,
        phone: cleanPhone,
        email: cleanEmail,
        address,
        openingBalance: opBal,
        password,
      });
      setForm({
        name: "",
        shopName: "",
        phone: "",
        email: "",
        address: "",
        openingBalance: "0",
        password: "",
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create customer"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePortal(id: number) {
    try {
      await updateCustomerPortalAccess(id, true);
      alert("Portal access enabled successfully! Customer can now log in using Email & Password or Phone + OTP.");
      load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not enable portal access"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Customers</h1>
          <p className="text-sm text-muted mt-1">
            Customer directory with self-service portal accounts, ledger history, and contact details.
          </p>
        </div>
        {can("customers", "create") && (
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New Customer"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Customer Name *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Rahul Sharma"
            />
          </div>
          <div>
            <label className="label">Shop Name (Optional)</label>
            <input
              className="input"
              value={form.shopName}
              onChange={(e) => setForm({ ...form, shopName: e.target.value })}
              placeholder="e.g. Sharma General Store"
            />
          </div>
          <div>
            <label className="label">Mobile Number * (10 Digits)</label>
            <input
              required
              type="tel"
              maxLength={10}
              className="input font-mono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
              placeholder="e.g. 9876543210"
            />
          </div>
          <div>
            <label className="label">Email Address * (For Portal Login)</label>
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. customer@example.com"
            />
          </div>
          <div>
            <label className="label">Address *</label>
            <input
              required
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. Shop 4, Sector 12, Noida"
            />
          </div>
          <div>
            <label className="label">
              Opening Balance (₹) <span className="text-xs text-muted">(+ Due, - Advance)</span>
            </label>
            <input
              type="number"
              step="any"
              className="input font-mono"
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Portal Login Password * (Min 6 Characters)</label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                minLength={6}
                className="input pr-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter secure password for customer login"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-muted mt-1">
              Customer can log in to Customer Portal on Web & Mobile App using their email and this password.
            </p>
          </div>

          {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Customer"}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-3">
        <input
          type="text"
          className="input max-w-sm"
          placeholder="Search by name, phone or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted font-mono">{customers.length} customer(s)</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Shop Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Current Balance</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted">
                  Loading customers…
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted">
                  No customers found. Click "+ New Customer" to add one.
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const bal = Number(c.current_balance);
                return (
                  <tr key={c.id}>
                    <td className="font-medium text-ink-900">
                      <ReferenceLink type="customer" id={c.id}>
                        {c.name}
                      </ReferenceLink>
                    </td>
                    <td className="text-xs text-muted">{c.shop_name || "—"}</td>
                    <td className="font-mono text-xs">{c.phone}</td>
                    <td className="text-xs text-muted">{c.email || "—"}</td>
                    <td>
                      <span
                        className={`font-mono font-medium ${
                          bal > 0 ? "text-danger" : bal < 0 ? "text-accent-600" : "text-muted"
                        }`}
                      >
                        ₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        {bal > 0 ? " (Due)" : bal < 0 ? " (Adv)" : ""}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.status === "active" ? "bg-accent-100 text-accent-700" : "bg-ink-100 text-ink-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePortal(c.id)}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        title="Customer Portal login enabled"
                      >
                        Portal Active
                      </button>
                      <Link
                        to={`/app/customers/${c.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        Profile
                      </Link>
                      <Link
                        to={`/app/ledger?customerId=${c.id}`}
                        className="text-xs text-accent-600 hover:text-accent-700 font-medium underline"
                      >
                        View Ledger
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Customers() {
  return (
    <RequireModule module="customers">
      <CustomersInner />
    </RequireModule>
  );
}
