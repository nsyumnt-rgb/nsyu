import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { switchShop } from "../api/shops";
import { apiErrorMessage, getApiBaseUrl, setApiBaseUrl, DEFAULT_CLOUD_API_URL, DEFAULT_LOCAL_API_URL } from "../api/client";
import { useAuthStore } from "../store/authStore";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);

  const [selectedShopId, setSelectedShopId] = useState("1");
  const [email, setEmail] = useState("nsyu.mnt@gmail.com");
  const [password, setPassword] = useState("Nsyu@12345");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Backend connection status
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline" | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const checkHealth = async (testUrl?: string) => {
    const target = (testUrl || apiUrl).trim().replace(/\/$/, "");
    setApiStatus("checking");
    setStatusMsg("Checking connection...");
    try {
      const healthEndpoint = target.endsWith("/api") ? `${target}/health` : `${target}/api/health`;
      const res = await fetch(healthEndpoint, { method: "GET" });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        setApiStatus("online");
        setStatusMsg(json?.database ? `Connected (${json.database})` : "API Online");
      } else {
        setApiStatus("offline");
        setStatusMsg(`API returned status ${res.status}`);
      }
    } catch {
      setApiStatus("offline");
      setStatusMsg("Unable to reach backend");
    }
  };

  useEffect(() => {
    checkHealth(apiUrl);
  }, []);

  const handleSaveApiUrl = (newUrl: string) => {
    setApiBaseUrl(newUrl);
    setApiUrl(newUrl);
    checkHealth(newUrl);
  };

  // Real shops from Supabase PostgreSQL database
  const shops = [
    { id: "1", name: "NSYU (Main Store)" },
  ];

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

      // If user selected a specific shop ID different from default
      if (selectedShopId && selectedShopId !== "" && (!(data as any).shop || Number(selectedShopId) !== (data as any).shop.id)) {
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
    } catch (err: any) {
      const baseErr = apiErrorMessage(err, "Invalid email or password. Please try again.");
      if (err.message && err.message.toLowerCase().includes("network error")) {
        if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
          setError(`Cannot reach local server at ${apiUrl}. If you do not want to run localhost on your laptop, switch to "24/7 Cloud (Render)" above.`);
        } else {
          setError(`Connecting to Cloud API (${apiUrl}). Free-tier cloud servers take 30-40s to wake up on first request. Please click "Test" above and retry in a moment.`);
        }
        setShowApiConfig(true);
      } else {
        setError(baseErr);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F5FA] flex flex-col justify-between font-sans">
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ============================================================== */}
          {/* LEFT COLUMN: REAL SYSTEM SHOWCASE & BRANDING                   */}
          {/* ============================================================== */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between py-6 pr-6">
            <div className="space-y-6">
              {/* Brand Logo */}
              <div className="flex items-center gap-3">
                <img
                  src="./nsyu_logo.png"
                  alt="NSYU Logo"
                  className="w-14 h-14 object-contain rounded-xl drop-shadow-md"
                />
                <div>
                  <div className="font-bold text-2xl text-slate-900 tracking-tight leading-tight">NSYU Business</div>
                  <div className="text-xs font-semibold text-blue-600 tracking-widest uppercase">
                    INNOVATE · INSPIRE · IMPACT
                  </div>
                </div>
              </div>

              {/* Headline */}
              <div className="pt-2 space-y-2">
                <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Manage Your Business
                  <span className="block text-blue-600 mt-1">Smarter and Simpler</span>
                </h1>
                <p className="text-sm xl:text-base text-slate-500 max-w-lg leading-relaxed pt-2">
                  Unified enterprise management for mobile accessories, catalog inventory, billing, customers, and shop operations.
                </p>
              </div>

              {/* Feature Highlight Cards */}
              <div className="grid grid-cols-2 gap-3.5 pt-2 max-w-xl">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">340+ Live Products</div>
                    <div className="text-[11px] text-slate-500 leading-tight mt-0.5">Real ERD chargers, docks, data cables & audio accessories in Supabase</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Fast POS Billing</div>
                    <div className="text-[11px] text-slate-500 leading-tight mt-0.5">Quick item search, barcode scan, GST invoice generation & print</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Customer Ledger</div>
                    <div className="text-[11px] text-slate-500 leading-tight mt-0.5">Account statements, payment receipts, due tracking & transaction history</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                      <line x1="6" y1="6" x2="6.01" y2="6" />
                      <line x1="6" y1="18" x2="6.01" y2="18" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Supabase Cloud Sync</div>
                    <div className="text-[11px] text-slate-500 leading-tight mt-0.5">Realtime PostgreSQL database synchronizing mobile app & web portal</div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Info Banner */}
            <div className="mt-8 p-4 bg-slate-900 rounded-2xl text-white shadow-xl max-w-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <div className="font-bold text-xs text-white">Supabase Cloud Database</div>
                    <div className="text-[11px] text-slate-400 font-mono">aws-0-ap-south-1.pooler.supabase.com</div>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                  Active
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: DIRECT AUTHENTICATION CARD                       */}
          {/* ============================================================== */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
              
              {/* Header Branding */}
              <div className="text-center space-y-2">
                <img
                  src="./nsyu_logo.png"
                  alt="NSYU Logo"
                  className="w-16 h-16 object-contain mx-auto drop-shadow-md"
                />
                <div className="font-bold text-base text-slate-900 tracking-tight">NSYU Business</div>
                <div className="text-[10px] font-semibold text-blue-600 tracking-widest uppercase -mt-1">
                  INNOVATE · INSPIRE · IMPACT
                </div>
                
                <div className="pt-2">
                  <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Enter your authorized credentials to continue</p>
                </div>
              </div>

              {/* API Server Indicator & Settings */}
              <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      apiStatus === "online"
                        ? "bg-emerald-500 shadow-xs shadow-emerald-500"
                        : apiStatus === "checking"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-blue-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-700 text-[11px] truncate flex items-center gap-1.5">
                      <span>API Server:</span>
                      <span className="font-mono text-[10px] text-blue-600 truncate">{apiUrl}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {apiStatus === "online"
                        ? statusMsg || "Cloud Database Connected"
                        : apiStatus === "checking"
                        ? "Connecting to backend..."
                        : apiUrl.includes("render.com")
                        ? "Render Cloud Backend (Click Test to wake up)"
                        : statusMsg || "Click Test to check"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => checkHealth(apiUrl)}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors"
                    title="Test connection to backend"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApiConfig(!showApiConfig)}
                    className="px-2 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    {showApiConfig ? "Hide" : "Settings"}
                  </button>
                </div>
              </div>

              {showApiConfig && (
                <div className="mt-2 p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">Backend Server Mode</label>
                    <span className="text-[10px] text-slate-500">24/7 Cloud or Local</span>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveApiUrl(DEFAULT_CLOUD_API_URL)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 ${
                        apiUrl === DEFAULT_CLOUD_API_URL
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      ☁️ 24/7 Cloud (Render)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveApiUrl(DEFAULT_LOCAL_API_URL)}
                      className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 ${
                        apiUrl === DEFAULT_LOCAL_API_URL
                          ? "bg-slate-700 text-white border-slate-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      💻 Localhost
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://nsyu-backend-api.onrender.com/api"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveApiUrl(apiUrl)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 text-xs shrink-0"
                    >
                      Save
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    • <strong>24/7 Cloud Backend</strong>: Runs continuously in the cloud even if your laptop is closed/turned off.<br />
                    • Connects directly to Supabase PostgreSQL (<code className="bg-white px-1 py-0.5 rounded border border-slate-200">aws-0-ap-south-1.pooler.supabase.com</code>).
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-medium">
                    {error}
                  </div>
                )}

                {/* Select Shop */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Store / Shop</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email / Username *</label>
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
                      placeholder="nsyu.mnt@gmail.com"
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
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
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
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                  <span>{loading ? "Signing in…" : "Sign In"}</span>
                </button>
              </form>

            </div>

            {/* Footer Links */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 px-2 gap-2">
              <div>
                Need assistance?{" "}
                <a href="mailto:nsyu.mnt@gmail.com" className="text-blue-600 hover:underline font-medium">
                  nsyu.mnt@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-3">
                <span>NSYU Business Management</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
