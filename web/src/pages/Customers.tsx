import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCustomers, createCustomer, updateCustomer, updateCustomerPortalAccess } from "../api/customers";
import { apiErrorMessage } from "../api/client";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import type { Customer } from "../types";
import { Avatar, EmptyState, Icon, IconButton, Meter, Modal, PageHeader, SearchInput, Segmented, StatCard } from "../components/ui";

/** The customer's ledger, inside the Customers page's Ledger tab. */
const ledgerUrl = (id: number) => `/app/customers?tab=ledger&customerId=${id}`;

/** Row click opens the ledger, unless the click was on a link or button inside the row. */
const fromControl = (e: React.MouseEvent) => Boolean((e.target as HTMLElement).closest("a,button,input,select,label"));

function CustomersInner() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "due" | "advance" | "settled">("all");
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
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid Email Address or leave it empty");
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
        email: cleanEmail || undefined,
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

  const dueTotal = customers.reduce((acc, c) => acc + Math.max(0, Number(c.current_balance) || 0), 0);
  const advanceTotal = customers.reduce((acc, c) => acc + Math.max(0, -(Number(c.current_balance) || 0)), 0);
  const dueCount = customers.filter((c) => Number(c.current_balance) > 0).length;
  const advCount = customers.filter((c) => Number(c.current_balance) < 0).length;
  const maxDue = Math.max(1, ...customers.map((c) => Number(c.current_balance) || 0));
  const visible = customers.filter((c) => {
    const b = Number(c.current_balance) || 0;
    return balanceFilter === "due" ? b > 0 : balanceFilter === "advance" ? b < 0 : balanceFilter === "settled" ? b === 0 : true;
  });

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="People"
        title="Customers"
        subtitle="Contacts, balances and customer portal access in one place."
        actions={
          can("customers", "create") && (
            <button type="button" className="btn-primary" onClick={() => { setError(null); setShowForm(true); }}>
              <Icon name="plus" /> New customer
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Customers" icon="users" tone="brand" value={customers.length.toLocaleString("en-IN")} loading={loading} active={balanceFilter === "all"} onClick={() => setBalanceFilter("all")} hint={search ? `Matching “${search}”` : "All customers"} />
        <StatCard label="Total outstanding" icon="wallet" tone="rose" value={inr0(dueTotal)} valueClass={dueTotal ? "text-rose-600" : undefined} loading={loading} hint="Customers owe you" />
        <StatCard label="With dues" icon="clock" tone="amber" value={String(dueCount)} loading={loading} active={balanceFilter === "due"} onClick={() => setBalanceFilter(balanceFilter === "due" ? "all" : "due")} hint="Tap to list them" />
        <StatCard label="Advances held" icon="rupee" tone="emerald" value={inr0(advanceTotal)} valueClass={advanceTotal ? "text-emerald-600" : undefined} loading={loading} active={balanceFilter === "advance"} onClick={() => setBalanceFilter(balanceFilter === "advance" ? "all" : "advance")} hint={`${advCount} customer${advCount === 1 ? "" : "s"} paid ahead`} />
      </div>

      <section className="card overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Segmented
            value={balanceFilter}
            onChange={setBalanceFilter}
            options={[
              { key: "all", label: "All", count: customers.length },
              { key: "due", label: "With dues", count: dueCount, tone: "rose" },
              { key: "advance", label: "Advance", count: advCount, tone: "emerald" },
              { key: "settled", label: "Settled", count: customers.length - dueCount - advCount },
            ]}
          />
          <SearchInput className="md:w-[300px]" value={search} onChange={setSearch} placeholder="Search name, phone or email…" />
        </div>

        {error && !showForm && (
          <div className="m-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
            <Icon name="alert" className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded bg-slate-100 w-1/3" />
                  <div className="h-2.5 rounded bg-slate-100 w-1/5" />
                </div>
                <div className="w-20 h-3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          customers.length === 0 && !search ? (
            <EmptyState
              icon="users"
              tone="brand"
              title="No customers yet"
              text="Add your first customer to start billing on credit and tracking dues."
              action={can("customers", "create") && <button type="button" onClick={() => setShowForm(true)} className="btn-primary btn-sm"><Icon name="plus" className="w-3.5 h-3.5" /> New customer</button>}
            />
          ) : (
            <EmptyState icon="search" title="No customers match" text="Try a different name, phone number or filter." />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => {
                    const bal = Number(c.current_balance) || 0;
                    return (
                      <tr key={c.id} className="cursor-pointer hover:bg-slate-50/70" title="Open ledger" onClick={(e) => !fromControl(e) && navigate(ledgerUrl(c.id))}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} />
                            <div className="min-w-0">
                              <Link to={ledgerUrl(c.id)} className="block truncate max-w-[220px] text-[13.5px] font-semibold text-navy-900 hover:text-brand-600">
                                {c.name}
                              </Link>
                              <div className="text-[12px] text-slate-500 truncate">{c.shop_name || "Individual"}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-[13px] text-slate-700 tabular">{c.phone}</div>
                          <div className="text-[12px] text-slate-500 truncate max-w-[220px]">{c.email || "—"}</div>
                        </td>
                        <td>
                          <BalanceCell bal={bal} max={maxDue} />
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`capitalize ${c.status === "active" ? "badge-active" : "badge-inactive"}`}>{c.status}</span>
                            <button type="button" onClick={() => handleTogglePortal(c.id)} className="badge-brand hover:bg-brand-100 transition-colors" title="Enable Customer Portal login">
                              Portal
                            </button>
                          </div>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <Link to={ledgerUrl(c.id)} className="btn-soft btn-sm">
                              <Icon name="file" className="w-3.5 h-3.5" /> Ledger
                            </Link>
                            <IconButton title="Open profile" icon="eye" to={`/app/customers/${c.id}`} />
                            {can("customers", "edit") && <IconButton title="Set portal password" icon="sliders" onClick={() => openPasswordDialog(c)} />}
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
              {visible.map((c) => {
                const bal = Number(c.current_balance) || 0;
                return (
                  <li key={c.id} className="px-4 py-4 cursor-pointer active:bg-slate-50" onClick={(e) => !fromControl(e) && navigate(ledgerUrl(c.id))}>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <Link to={ledgerUrl(c.id)} className="text-[14px] font-semibold text-navy-900 truncate block">{c.name}</Link>
                        <div className="text-[12px] text-slate-500 truncate">{c.phone}{c.shop_name ? ` · ${c.shop_name}` : ""}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[14px] font-bold tabular ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}>{inr2(Math.abs(bal))}</div>
                        <div className="text-[11px] text-slate-400">{bal > 0 ? "Due" : bal < 0 ? "Advance" : "Settled"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-3">
                      <span className={`capitalize ${c.status === "active" ? "badge-active" : "badge-inactive"}`}>{c.status}</span>
                      <button type="button" onClick={() => handleTogglePortal(c.id)} className="badge-brand">Portal</button>
                      <div className="flex-1" />
                      {can("customers", "edit") && <IconButton title="Set portal password" icon="sliders" onClick={() => openPasswordDialog(c)} />}
                      <IconButton title="Open profile" icon="eye" to={`/app/customers/${c.id}`} />
                      <Link to={ledgerUrl(c.id)} className="btn-soft btn-sm">Ledger</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* New customer */}
      {showForm && (
        <Modal
          icon="users"
          title="New customer"
          subtitle="They can sign in to the Customer Portal with their mobile/email and password."
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" form="new-customer-form" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save customer"}</button>
            </>
          }
        >
          <form id="new-customer-form" onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Customer name *</label>
              <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahul Sharma" autoFocus />
            </div>
            <div>
              <label className="label">Mobile number * <span className="font-normal text-slate-400">(10 digits)</span></label>
              <input required type="tel" maxLength={10} className="input tabular" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="9876543210" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Shop name <span className="font-normal text-slate-400">(optional — the customer's business)</span></label>
              <input className="input" maxLength={150} value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="e.g. Sharma Mobile Store" />
            </div>
            <div>
              <label className="label">Email <span className="font-normal text-slate-400">(optional)</span></label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="customer@example.com" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address *</label>
              <input required className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Shop 4, Sector 12, Noida" />
            </div>
            <div>
              <label className="label">Opening balance (₹) <span className="font-normal text-slate-400">+ due, − advance</span></label>
              <input type="number" step="any" className="input tabular" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Portal password * <span className="font-normal text-slate-400">(min 6)</span></label>
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} minLength={6} className="input pr-14" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Login password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-slate-500 hover:text-slate-800">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {error && (
              <p className="sm:col-span-2 flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {error}</p>
            )}
          </form>
        </Modal>
      )}

      {/* Portal password */}
      {pwdCustomer && (
        <Modal
          size="sm"
          icon="sliders"
          title="Customer portal login"
          subtitle={`${pwdCustomer.name} · ${pwdCustomer.email || pwdCustomer.phone}`}
          onClose={() => setPwdCustomer(null)}
          footer={
            pwdDone ? (
              <button type="button" onClick={() => setPwdCustomer(null)} className="btn-primary">Done</button>
            ) : (
              <>
                <button type="button" onClick={() => setPwdCustomer(null)} className="btn-secondary">Cancel</button>
                <button type="submit" form="portal-pwd-form" disabled={pwdSaving} className="btn-primary">{pwdSaving ? "Saving…" : "Save password"}</button>
              </>
            )
          }
        >
          {pwdDone ? (
            <div className="flex gap-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-[13px] text-emerald-800">
              <Icon name="checkCircle" className="w-5 h-5 shrink-0" />
              <span>
                Password updated. The customer can now sign in to the Customer Portal with
                <span className="font-semibold"> {pwdCustomer.email || pwdCustomer.phone}</span> and the new password.
              </span>
            </div>
          ) : (
            <form id="portal-pwd-form" onSubmit={handleSetPassword} className="space-y-3">
              <div>
                <label className="label">New password (min 6 characters)</label>
                <div className="relative">
                  <input type={showNewPwd ? "text" : "password"} minLength={6} required autoFocus className="input pr-14" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Enter a new login password" />
                  <button type="button" onClick={() => setShowNewPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-slate-500 hover:text-slate-800">
                    {showNewPwd ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1.5">Creates the portal account if it doesn&apos;t exist yet, and enables access.</p>
              </div>
              {pwdError && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600"><Icon name="alert" className="w-3.5 h-3.5" /> {pwdError}</p>
              )}
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

const inr0 = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const inr2 = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BalanceCell({ bal, max }: { bal: number; max: number }) {
  return (
    <div className="w-[130px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-[14px] font-bold tabular ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>{inr2(Math.abs(bal))}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{bal > 0 ? "Due" : bal < 0 ? "Adv." : "Nil"}</span>
      </div>
      {bal > 0 && <Meter value={bal} max={max} tone="rose" className="mt-1" />}
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
