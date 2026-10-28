import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { switchShop } from "../api/shops";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);

  const [selectedShopId, setSelectedShopId] = useState("1");
  const [email, setEmail] = useState("owner@nsy.com");
  const [password, setPassword] = useState("Demo@12345");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Available shops for selection
  const shops = [
    { id: "1", name: "Main Shop - Electronics", code: "MS-01" },
    { id: "2", name: "Branch Shop 1 - Mobile", code: "BS-01" },
    { id: "3", name: "Branch Shop 2 - Tech Hub", code: "BS-02" },
  ];

  // Demo accounts for 1-click testing
  const demoAccounts = [
    {
      role: "Owner",
      email: "owner@nsy.com",
      password: "Demo@12345",
      shopId: "1",
      iconColor: "bg-purple-100 text-purple-600",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      role: "Manager",
      email: "manager@nsy.com",
      password: "Demo@12345",
      shopId: "1",
      iconColor: "bg-blue-100 text-blue-600",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      role: "Sales",
      email: "sales@nsy.com",
      password: "Demo@12345",
      shopId: "1",
      iconColor: "bg-emerald-100 text-emerald-600",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      ),
    },
    {
      role: "Employee",
      email: "employee@nsy.com",
      password: "Demo@12345",
      shopId: "1",
      iconColor: "bg-amber-100 text-amber-600",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  function handleQuickFill(acc: typeof demoAccounts[0]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedShopId(acc.shopId);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await loginApi(email, password);
      const data = res.data.data!;
      setSession(data.accessToken, data.refreshToken, data.accountType);

      if ((data as any).shop) {
        setActiveShop((data as any).shop);
      }

      // If user specifically picked a shop different from default
      if (selectedShopId && (!(data as any).shop || Number(selectedShopId) !== (data as any).shop.id)) {
        try {
          const switchRes = await switchShop(Number(selectedShopId));
          const switchedData = switchRes.data.data!;
          setAccessToken(switchedData.accessToken, switchedData.shop.id, null, null);
          setActiveShop(switchedData.shop);
        } catch {
          // Fallback to active shop from login
        }
      }

      navigate("/app");
    } catch (err) {
      setError(apiErrorMessage(err, "Invalid email or password. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F5FA] flex flex-col justify-between font-sans">
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ============================================================== */}
          {/* LEFT COLUMN: HERO PROMOTIONAL BANNER & VISUAL MOCKUP          */}
          {/* ============================================================== */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between py-6 pr-6">
            <div className="space-y-6">
              {/* Brand Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-xl text-slate-900 tracking-tight leading-tight">NSY Business</div>
                  <div className="text-[11px] font-medium text-slate-500">Multi-Shop Management</div>
                </div>
              </div>

              {/* Headline */}
              <div className="pt-4 space-y-2">
                <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Manage Your Business
                  <span className="block text-blue-600 mt-1">Smarter and Simpler</span>
                </h1>
                <p className="text-sm xl:text-base text-slate-500 max-w-lg leading-relaxed pt-2">
                  Complete solution for multi-shop business management with inventory, sales, purchase, customers, employees and more.
                </p>
              </div>

              {/* 5 Feature Highlight Icons */}
              <div className="flex items-center gap-4 xl:gap-6 pt-4">
                {/* 1. Inventory */}
                <div className="flex flex-col items-center gap-2 text-center w-20">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs border border-emerald-100">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight">Inventory Management</span>
                </div>

                {/* 2. Sales & Purchase */}
                <div className="flex flex-col items-center gap-2 text-center w-20">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs border border-blue-100">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight">Sales & Purchase</span>
                </div>

                {/* 3. Customer */}
                <div className="flex flex-col items-center gap-2 text-center w-20">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs border border-amber-100">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight">Customer Management</span>
                </div>

                {/* 4. Employee */}
                <div className="flex flex-col items-center gap-2 text-center w-20">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs border border-purple-100">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <polyline points="17 11 19 13 23 9" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight">Employee Management</span>
                </div>

                {/* 5. Reports */}
                <div className="flex flex-col items-center gap-2 text-center w-20">
                  <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-xs border border-rose-100">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 leading-tight">Reports & Analytics</span>
                </div>
              </div>
            </div>

            {/* Dashboard & Mobile Preview Mockup */}
            <div className="relative mt-8 pt-4">
              {/* Dashboard Preview Card */}
              <div className="w-full bg-white rounded-2xl p-4 shadow-xl shadow-slate-200/80 border border-slate-200/70 overflow-hidden text-xs">
                {/* Mini Topbar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">N</div>
                    <span className="font-bold text-slate-800 text-[11px]">NSY Business</span>
                  </div>
                  <div className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-medium">
                    🏪 Main Shop - Electronics
                  </div>
                </div>

                {/* 4 Mini Metric Cards */}
                <div className="grid grid-cols-4 gap-2.5 py-3">
                  <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100/60">
                    <div className="text-[9.5px] text-slate-500 font-medium">Total Sales</div>
                    <div className="text-xs font-bold text-slate-800">₹ 8,42,500</div>
                    <div className="text-[8.5px] text-emerald-600 font-semibold">↑ 12%</div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100/60">
                    <div className="text-[9.5px] text-slate-500 font-medium">Total Purchase</div>
                    <div className="text-xs font-bold text-slate-800">₹ 5,28,300</div>
                    <div className="text-[8.5px] text-blue-600 font-semibold">↑ 8%</div>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-50/70 border border-purple-100/60">
                    <div className="text-[9.5px] text-slate-500 font-medium">Total Customers</div>
                    <div className="text-xs font-bold text-slate-800">286</div>
                    <div className="text-[8.5px] text-purple-600 font-semibold">↑ 12%</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100/60">
                    <div className="text-[9.5px] text-slate-500 font-medium">Total Products</div>
                    <div className="text-xs font-bold text-slate-800">1,248</div>
                    <div className="text-[8.5px] text-amber-600 font-semibold">↑ 5%</div>
                  </div>
                </div>

                {/* Mini Charts & Table */}
                <div className="grid grid-cols-12 gap-3 pt-1">
                  <div className="col-span-7 bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-700 mb-1.5 flex justify-between">
                      <span>Sales Overview</span>
                      <span className="text-[8.5px] text-blue-600">● Sales  ● Purchase</span>
                    </div>
                    <div className="h-14 flex items-end gap-1.5 pt-1">
                      {[30, 45, 60, 50, 75, 85, 95, 70, 90, 110, 100, 120].map((v, i) => (
                        <div key={i} className="flex-1 bg-blue-600 rounded-t" style={{ height: `${(v / 120) * 100}%` }} />
                      ))}
                    </div>
                  </div>

                  <div className="col-span-5 bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-700">Top Categories</div>
                      <div className="text-[9px] text-slate-500 mt-1 space-y-0.5">
                        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Electronics</div>
                        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Mobiles</div>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-r-amber-400 border-b-purple-500 flex items-center justify-center text-[9px] font-bold text-slate-700">
                      1,248
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Mobile Mockup */}
              <div className="absolute -bottom-4 right-6 w-36 bg-slate-900 rounded-2xl p-1.5 shadow-2xl border-2 border-slate-700 hidden xl:block">
                <div className="bg-white rounded-xl p-2 text-[8px] text-slate-800 space-y-1.5">
                  <div className="text-center font-bold text-[9px] text-slate-900">NSY Business</div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="p-1 rounded bg-emerald-50 font-bold text-emerald-700">₹ 8.4L</div>
                    <div className="p-1 rounded bg-blue-50 font-bold text-blue-700">₹ 5.2L</div>
                  </div>
                  <div className="h-8 bg-blue-100 rounded flex items-end gap-0.5 p-0.5">
                    {[4, 6, 8, 12, 10, 14, 16].map((h, i) => (
                      <div key={i} className="flex-1 bg-blue-600 rounded-t" style={{ height: `${h * 2}px` }} />
                    ))}
                  </div>
                  <div className="text-[7.5px] text-center text-slate-400 pt-0.5">Mobile Sync Active</div>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: LOGIN FORM CARD & DEMO ACCOUNTS                 */}
          {/* ============================================================== */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
              
              {/* Header Branding */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25 mx-auto">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="font-bold text-base text-slate-900 tracking-tight">NSY Business</div>
                <div className="text-[11px] font-medium text-slate-400 -mt-1">Multi-Shop Management</div>
                
                <div className="pt-2">
                  <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Sign in to your account to continue</p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-medium">
                    {error}
                  </div>
                )}

                {/* Select Shop */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Shop *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <select
                      value={selectedShopId}
                      onChange={(e) => setSelectedShopId(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                    >
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="text-slate-600 font-medium">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => alert("Password reset link has been dispatched to your email.")}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>{loading ? "Signing in…" : "Login"}</span>
                </button>
              </form>

              {/* OR Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">OR</span>
                </div>
              </div>

              {/* Demo Accounts Quick-Fill Section */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-600">Demo Accounts (for testing)</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleQuickFill(acc)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        email === acc.email
                          ? "border-blue-500 bg-blue-50/50 shadow-xs"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/80"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${acc.iconColor} flex items-center justify-center shrink-0`}>
                        {acc.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-[11px] leading-tight">{acc.role}</div>
                        <div className="text-[10px] text-slate-400 truncate">{acc.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer Links */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 px-2 gap-2">
              <div>
                Need help?{" "}
                <a href="#support" className="text-blue-600 hover:underline font-medium">
                  Contact Support
                </a>
              </div>
              <div className="flex items-center gap-3">
                <a href="#privacy" className="hover:underline">Privacy Policy</a>
                <span>|</span>
                <a href="#terms" className="hover:underline">Terms of Service</a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
