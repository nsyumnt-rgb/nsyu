import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCustomers, createCustomer, updateCustomer, updateCustomerPortalAccess } from "../api/customers";
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

  // Owner-side reset of a customer's portal login password
  const [pwdCustomer, setPwdCustomer] = useState<Customer | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState(false);

  function openPasswordDialog(c: Customer) {
    setPwdCustomer(c);
    setNewPwd("");
    setShowNewPwd(false);
    setPwdError(null);
    setPwdDone(false);
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdCustomer) return;
    if (newPwd.trim().length < 6) {
      setPwdError("Password must be at least 6 characters.");
      return;
    }
    setPwdSaving(true);
    setPwdError(null);
    try {
      await updateCustomer(pwdCustomer.id, { password: newPwd.trim() });
      try {
        await updateCustomerPortalAccess(pwdCustomer.id, true);
      } catch {
        /* account is created active by the password update; enabling is best-effort */
      }
      setPwdDone(true);
    } catch (err) {
      setPwdError(apiErrorMessage(err, "Could not update the login password"));
    } finally {
      setPwdSaving(false);
    }
  }

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
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            Contacts, balances and customer portal access in one place.
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

      {/* ── Summary + search ─────────────────────────────────── */}
      {(() => {
        const dueTotal = customers.reduce((acc, c) => acc + Math.max(0, Number(c.current_balance) || 0), 0);
        const dueCount = customers.filter((c) => Number(c.current_balance) > 0).length;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="icon-tile bg-brand-50 text-brand-600">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <div>
                <div className="stat-label">Customers</div>
                <div className="text-[20px] font-bold text-navy-900 tabular">{customers.length}</div>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="icon-tile bg-rose-50 text-rose-600">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </div>
              <div>
                <div className="stat-label">Total outstanding</div>
                <div className="text-[20px] font-bold text-rose-600 tabular">
                  ₹{dueTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="icon-tile bg-amber-50 text-amber-600">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <div>
                <div className="stat-label">Customers with dues</div>
                <div className="text-[20px] font-bold text-navy-900 tabular">{dueCount}</div>
              </div>
            </div>
          </div>
        );
      })()}

      <section className="card overflow-hidden">
        <div className="card-header flex-col sm:flex-row items-stretch sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              type="text"
              className="input pl-9"
              placeholder="Search by name, phone or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-[12px] text-slate-500">{customers.length} customer{customers.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? (
          <div className="py-14 text-center text-[13px] text-slate-500">
            <div className="w-6 h-6 mx-auto mb-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            Loading customers…
          </div>
        ) : customers.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
            </div>
            <div className="text-[13.5px] font-semibold text-navy-900">No customers found</div>
            <p className="text-[12.5px] text-slate-500 mt-1">Click “New Customer” to add your first customer.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th className="!text-right">Balance</th>
                    <th>Status</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const bal = Number(c.current_balance);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-navy-800 text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
                              {(c.name || "C").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <ReferenceLink type="customer" id={c.id} className="!font-sans !no-underline text-[13.5px] font-semibold text-navy-900 hover:text-brand-600">
                                {c.name}
                              </ReferenceLink>
                              <div className="text-[12px] text-slate-500 truncate">{c.shop_name || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-[13px] text-slate-700 tabular">{c.phone}</div>
                          <div className="text-[12px] text-slate-500 truncate max-w-[220px]">{c.email || "—"}</div>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className={`text-[14px] font-bold tabular ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                            ₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-slate-400">{bal > 0 ? "Due" : bal < 0 ? "Advance" : "Settled"}</div>
                        </td>
                        <td>
                          <div className="flex flex-col items-start gap-1">
                            <span className={`capitalize ${c.status === "active" ? "badge-active" : "badge-inactive"}`}>{c.status}</span>
                            <button
                              type="button"
                              onClick={() => handleTogglePortal(c.id)}
                              className="badge-brand hover:bg-brand-100 transition-colors"
                              title="Customer Portal login enabled"
                            >
                              Portal active
                            </button>
                          </div>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {can("customers", "edit") && (
                              <button type="button" onClick={() => openPasswordDialog(c)} className="btn-ghost btn-sm" title="Set customer portal login password">
                                Set password
                              </button>
                            )}
                            <Link to={`/app/customers/${c.id}`} className="btn-secondary btn-sm">Profile</Link>
                            <Link to={`/app/ledger?customerId=${c.id}`} className="btn-soft btn-sm">Ledger</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {customers.map((c) => {
                const bal = Number(c.current_balance);
                return (
                  <li key={c.id} className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-navy-800 text-white flex items-center justify-center text-[14px] font-semibold shrink-0">
                        {(c.name || "C").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/app/customers/${c.id}`} className="text-[14px] font-semibold text-navy-900 truncate block">{c.name}</Link>
                        <div className="text-[12px] text-slate-500 truncate">{c.phone}{c.shop_name ? ` · ${c.shop_name}` : ""}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[14px] font-bold tabular ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                          ₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-400">{bal > 0 ? "Due" : bal < 0 ? "Advance" : "Settled"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`capitalize ${c.status === "active" ? "badge-active" : "badge-inactive"}`}>{c.status}</span>
                      <button type="button" onClick={() => handleTogglePortal(c.id)} className="badge-brand">Portal active</button>
                      <div className="flex-1" />
                      {can("customers", "edit") && (
                        <button type="button" onClick={() => openPasswordDialog(c)} className="btn-ghost btn-sm">Password</button>
                      )}
                      <Link to={`/app/customers/${c.id}`} className="btn-secondary btn-sm">Profile</Link>
                      <Link to={`/app/ledger?customerId=${c.id}`} className="btn-soft btn-sm">Ledger</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {pwdCustomer && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-scale-up">
            <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold">Customer portal login</h2>
                <p className="text-[12.5px] text-slate-500 mt-0.5">
                  {pwdCustomer.name} · {pwdCustomer.email || pwdCustomer.phone}
                </p>
              </div>
              <button type="button" onClick={() => setPwdCustomer(null)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Close">✕</button>
            </div>
            {pwdDone ? (
              <div className="px-6 pb-6 pt-2">
                <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-[13px] text-emerald-800">
                  Password updated. The customer can now sign in to the Customer Portal with
                  <span className="font-semibold"> {pwdCustomer.email || pwdCustomer.phone}</span> and the new password.
                </div>
                <button type="button" onClick={() => setPwdCustomer(null)} className="btn-primary w-full mt-4">Done</button>
              </div>
            ) : (
              <form onSubmit={handleSetPassword} className="px-6 pb-6 pt-2 space-y-4">
                <div>
                  <label className="label">New password (min 6 characters)</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      minLength={6}
                      required
                      autoFocus
                      className="input pr-14"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Enter a new login password"
                    />
                    <button type="button" onClick={() => setShowNewPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-slate-500 hover:text-slate-800">
                      {showNewPwd ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-1.5">Creates the portal account if it doesn&apos;t exist yet, and enables access.</p>
                </div>
                {pwdError && <p className="text-[12.5px] text-rose-600">{pwdError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPwdCustomer(null)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={pwdSaving} className="btn-primary flex-1">{pwdSaving ? "Saving…" : "Save password"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
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
