import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalStore } from "../../store/portalStore";
import { updatePortalProfileApi, logoutCustomerApi, changePortalPasswordApi } from "../../api/portal";
import { apiErrorMessage } from "../../api/client";

export default function PortalProfile() {
  const navigate = useNavigate();
  const customer = usePortalStore((s) => s.customer);
  const updateCustomerProfile = usePortalStore((s) => s.updateCustomerProfile);

  const [email, setEmail] = useState(customer?.email || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updatePortalProfileApi({
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
      updateCustomerProfile({ email, address });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutCustomerApi();
    navigate("/portal/login", { replace: true });
  };

  const balance = Number(customer?.currentBalance ?? 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="page-title">Profile & Shop Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your contact details and view linked shop information.</p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition border border-rose-200"
        >
          Sign Out
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <span>✓ Profile information updated successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* Account Info Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-2 border-b border-gray-100">
          Account Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Full Name / Business Name
            </label>
            <input
              type="text"
              disabled
              value={customer?.name || ""}
              className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 cursor-not-allowed"
            />
            <span className="text-[10px] text-gray-400 mt-1 block">Contact shop staff to change account name</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Verified Mobile Number
            </label>
            <input
              type="text"
              disabled
              value={customer?.phone ? `+91 ${customer.phone}` : ""}
              className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 cursor-not-allowed"
            />
            <span className="text-[10px] text-gray-400 mt-1 block">Primary login number</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              GSTIN (Tax ID)
            </label>
            <input
              type="text"
              disabled
              value={customer?.gstin || "Not provided"}
              className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Current Ledger Balance
            </label>
            <div
              className={`px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black ${
                balance > 0 ? "text-rose-600" : balance < 0 ? "text-emerald-600" : "text-gray-800"
              }`}
            >
              ₹{Math.abs(balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              <span className="text-xs font-normal text-gray-500 ml-1.5">
                ({balance > 0 ? "Due to shop" : balance < 0 ? "Advance credit" : "Zero balance"})
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. sharma@example.com"
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Delivery / Billing Address
          </label>
          <textarea
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Shop address or home address for order deliveries..."
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow transition"
          >
            {saving ? "Saving Changes..." : "Save Profile Details"}
          </button>
        </div>
      </form>

      <ChangePasswordCard />

      {/* Linked Shop Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-2 border-b border-gray-100">
          Linked Shop Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-400 block">Shop Name</span>
            <span className="font-bold text-sm text-gray-800">{customer?.shop?.name}</span>
          </div>

          <div>
            <span className="text-gray-400 block">Shop Code</span>
            <span className="font-bold text-sm text-gray-800 font-mono uppercase">{customer?.shop?.code}</span>
          </div>

          <div>
            <span className="text-gray-400 block">Shop Helpline Phone</span>
            <span className="font-semibold text-gray-800">
              {customer?.shop?.phone ? `+91 ${customer.shop.phone}` : "—"}
            </span>
          </div>

          <div>
            <span className="text-gray-400 block">Shop Email</span>
            <span className="font-semibold text-gray-800">{customer?.shop?.email || "—"}</span>
          </div>

          <div className="sm:col-span-2">
            <span className="text-gray-400 block">Shop Address</span>
            <span className="font-semibold text-gray-800">{customer?.shop?.address || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


/** Change password (needs the current one). Other devices are signed out; this one stays signed in. */
function ChangePasswordCard() {
  const refreshToken = usePortalStore((st) => st.refreshToken);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.trim().length < 6) return setMsg({ ok: false, text: "New password must be at least 6 characters." });
    if (next !== confirm) return setMsg({ ok: false, text: "The new passwords don't match." });
    setBusy(true);
    try {
      const r = await changePortalPasswordApi({ currentPassword: current, newPassword: next, refreshToken });
      setMsg({ ok: true, text: r.message || "Password changed." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setMsg({ ok: false, text: apiErrorMessage(err, "Could not change the password") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Change password</h2>
        <button type="button" onClick={() => setShow((v) => !v)} className="text-[12px] font-semibold text-brand-700 hover:underline">{show ? "Hide" : "Show"} passwords</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="label">Current password</span>
          <input type={show ? "text" : "password"} autoComplete="current-password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Leave empty if you only use OTP" />
        </label>
        <label className="block">
          <span className="label">New password</span>
          <input type={show ? "text" : "password"} autoComplete="new-password" minLength={6} required className="input" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 6 characters" />
        </label>
        <label className="block">
          <span className="label">Confirm new password</span>
          <input type={show ? "text" : "password"} autoComplete="new-password" minLength={6} required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
      </div>
      {msg && <p className={`text-[13px] rounded-lg px-3 py-2 ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Change password"}</button>
      </div>
    </form>
  );
}
