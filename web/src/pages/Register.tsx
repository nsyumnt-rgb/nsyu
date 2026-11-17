import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerOwner } from "../api/auth";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import AuthShell, { AUTH_FIELD, AUTH_LABEL, AUTH_PRIMARY } from "../components/AuthShell";

export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await registerOwner(form);
      const data = res.data.data!;
      setSession(data.accessToken, data.refreshToken, data.accountType);
      navigate("/app");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create account"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      headline="Open your shop on NSYU in minutes."
      extra={
        <p className="mt-6 text-center text-[13.5px] text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">Sign in</Link>
        </p>
      }
    >
      <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight leading-tight">Create your owner account</h1>
      <p className="mt-1.5 text-[14px] text-slate-500">Staff roles (Manager, Sales, Billing, Inventory, Accountant) are set up for you automatically.</p>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] text-rose-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="reg-owner-name" className={AUTH_LABEL}>Full name</label>
          <input id="reg-owner-name" required autoComplete="name" className={AUTH_FIELD} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label htmlFor="reg-owner-email" className={AUTH_LABEL}>Email</label>
          <input id="reg-owner-email" type="email" required autoComplete="email" className={AUTH_FIELD} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@business.com" />
        </div>
        <div>
          <label htmlFor="reg-owner-phone" className={AUTH_LABEL}>Phone <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="reg-owner-phone" type="tel" inputMode="tel" autoComplete="tel" className={AUTH_FIELD} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="98765 43210" />
        </div>
        <div>
          <label htmlFor="reg-owner-password" className={AUTH_LABEL}>Password</label>
          <div className="relative">
            <input
              id="reg-owner-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              className={`${AUTH_FIELD} pr-16`}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="At least 6 characters"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-4 text-[12.5px] font-semibold text-slate-500 hover:text-navy-900">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className={`${AUTH_PRIMARY} w-full h-12 text-[15px]`}>
          {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
