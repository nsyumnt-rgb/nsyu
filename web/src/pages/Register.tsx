import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerOwner } from "../api/auth";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";

export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-ink-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-9 w-9 rounded-md bg-accent flex items-center justify-center font-display text-base font-semibold text-white">
            N
          </div>
          <span className="font-display text-xl font-semibold text-white tracking-tight">NSYU Business</span>
        </div>

        <div className="card p-7">
          <h1 className="text-lg mb-1">Create your owner account</h1>
          <p className="text-sm text-muted mb-6">
            You'll get the standard roles (Manager, Sales Staff, Billing Staff, Inventory Staff, Accountant) automatically.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input required className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/50 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
