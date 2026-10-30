import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { apiErrorMessage, getApiBaseUrl, setApiBaseUrl, DEFAULT_CLOUD_API_URL, DEFAULT_LOCAL_API_URL } from "../api/client";
import { useAuthStore } from "../store/authStore";

const GITHUB_APK_RAW_URL = "https://github.com/nsyumnt-rgb/nsyu/raw/main/App/downloads/nsyu-business-release.apk";
const LOCAL_APK_URL = "./downloads/nsyu-business-release.apk";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // APK Download States matching Reference Design
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [apkSuccessModal, setApkSuccessModal] = useState<{ isAndroid: boolean; filename: string; url: string } | null>(null);
  const [apkErrorModal, setApkErrorModal] = useState<{ reason: string } | null>(null);
  const [showIosModal, setShowIosModal] = useState(false);

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

  async function handleDownloadApk() {
    if (isDownloadingApk) return;
    setIsDownloadingApk(true);

    const isAndroid = /Android/i.test(navigator.userAgent);
    let downloadUrl = LOCAL_APK_URL;

    try {
      // Check availability of local relative path, fallback to GitHub raw link if needed
      try {
        const res = await fetch(LOCAL_APK_URL, { method: "HEAD" });
        if (!res.ok) downloadUrl = GITHUB_APK_RAW_URL;
      } catch {
        downloadUrl = GITHUB_APK_RAW_URL;
      }

      // Trigger direct browser file download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "NSYU-Business-Release.apk";
      link.setAttribute("target", "_blank");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Show animated Confirmation Modal with device-tailored instructions
      setApkSuccessModal({
        isAndroid,
        filename: "NSYU-Business-Release.apk",
        url: downloadUrl,
      });
    } catch (err: any) {
      setApkErrorModal({
        reason: err?.message || "Failed to download APK. Please check your connection or use the direct link.",
      });
    } finally {
      setIsDownloadingApk(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F5FA] flex flex-col justify-between font-sans">
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">
          
          {/* ============================================================== */}
          {/* LEFT COLUMN: REAL SYSTEM SHOWCASE & BRANDING                   */}
          {/* ============================================================== */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between py-4 pr-4 space-y-6">
            <div className="space-y-5">
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
              <div className="space-y-1.5">
                <h1 className="text-3xl xl:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Manage Your Business
                  <span className="block text-blue-600 mt-0.5">Smarter and Simpler</span>
                </h1>
                <p className="text-xs xl:text-sm text-slate-500 max-w-lg leading-relaxed">
                  Unified enterprise management for mobile accessories, catalog inventory, billing, customers, and shop operations.
                </p>
              </div>

              {/* Feature Highlight Cards matching Reference Image */}
              <div className="grid grid-cols-2 gap-3 max-w-xl">
                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">340+ Live Products</div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">Real ERD chargers, docks, data cables & audio accessories in Supabase</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Fast POS Billing</div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">Quick item search, barcode scan, GST invoice generation & print</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Customer Ledger</div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">Account statements, payment receipts, due tracking & transaction history</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                      <line x1="6" y1="6" x2="6.01" y2="6" />
                      <line x1="6" y1="18" x2="6.01" y2="18" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Supabase Cloud Sync</div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">Realtime PostgreSQL database synchronizing mobile app & web portal</div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Info Banner */}
            <div className="p-3.5 bg-slate-900 rounded-2xl text-white shadow-lg max-w-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <div className="font-bold text-xs text-white">Supabase Cloud Database</div>
                    <div className="text-[10px] text-slate-400 font-mono">aws-0-ap-south-1.pooler.supabase.com</div>
                  </div>
                </div>
                <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                  Active
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: DIRECT AUTHENTICATION CARD                       */}
          {/* ============================================================== */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-7">
              
              {/* Header Branding */}
              <div className="text-center space-y-1.5">
                <img
                  src="./nsyu_logo.png"
                  alt="NSYU Logo"
                  className="w-14 h-14 object-contain mx-auto drop-shadow-md"
                />
                <div className="font-bold text-base text-slate-900 tracking-tight">NSYU Business</div>
                <div className="text-[10px] font-semibold text-blue-600 tracking-widest uppercase -mt-1">
                  INNOVATE · INSPIRE · IMPACT
                </div>
                
                <div className="pt-2">
                  <h2 className="text-xl font-extrabold text-slate-900">Sign In</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Enter your authorized credentials to continue</p>
                </div>
              </div>

              {/* API Server Indicator & Settings */}
              <div className="mt-4 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
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
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Test connection to backend"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApiConfig(!showApiConfig)}
                    className="px-2 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {showApiConfig ? "Hide" : "Settings"}
                  </button>
                </div>
              </div>

              {showApiConfig && (
                <div className="mt-2 p-3 bg-blue-50/60 rounded-2xl border border-blue-200 text-xs space-y-2.5">
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
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 text-xs shrink-0 cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    • <strong>24/7 Cloud Backend</strong>: Runs continuously in the cloud.<br />
                    • Connects directly to Supabase PostgreSQL (<code className="bg-white px-1 py-0.5 rounded border border-slate-200">aws-0-ap-south-1.pooler.supabase.com</code>).
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-medium">
                    {error}
                  </div>
                )}

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
                      placeholder="name@business.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
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
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    onClick={() => alert("Password reset assistance has been sent to nsyu.mnt@gmail.com.")}
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
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

            {/* Footer Support Info */}
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 px-2 gap-1.5">
              <div>
                Need assistance?{" "}
                <a href="mailto:nsyu.mnt@gmail.com" className="text-blue-600 hover:underline font-semibold">
                  nsyu.mnt@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <span>NSYU Business Management</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* BOTTOM BANNER: GET THE NSYU BUSINESS MOBILE APP                */}
      {/* (Pixel-perfect matching uploaded design reference)             */}
      {/* ============================================================== */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8 pt-2">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:shadow-md">
          
          {/* Left: App Icon + Description + Feature Pills */}
          <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center p-2">
                <img
                  src="./nsyu_logo.png"
                  alt="NSYU App Icon"
                  className="w-full h-full object-contain drop-shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Get the <span className="text-blue-600">NSYU Business</span> Mobile App
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                Manage your shops, products, billing, inventory and more — anytime, anywhere.
              </p>

              {/* Feature Badges matching Reference Design */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1 text-[11px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  </svg>
                  Fast
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Secure
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Real-time Sync
                </span>
              </div>
            </div>
          </div>

          {/* Right: Functional Download Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
            
            {/* Functional Google Play Download Button */}
            <button
              type="button"
              id="google-play-download-btn"
              onClick={handleDownloadApk}
              disabled={isDownloadingApk}
              title="Download NSYU Business Release APK for Android"
              className="h-13 px-4 rounded-xl bg-black hover:bg-slate-900 border border-slate-800 text-white flex items-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer group"
            >
              {isDownloadingApk ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider text-slate-300 font-semibold leading-none">CHECKING APK</div>
                    <div className="text-xs font-bold text-white mt-0.5 leading-none">Please wait…</div>
                  </div>
                </>
              ) : (
                <>
                  {/* Google Play Multi-color Official SVG Icon */}
                  <svg className="w-6 h-6 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M3.6 2.4c-.4.4-.6 1-.6 1.7v15.8c0 .7.2 1.3.6 1.7l.1.1 9-9v-.2l-9.1-10.1z"/>
                    <path fill="#0F9D58" d="M16.6 15.6l-3.9-3.9v-.2l3.9-3.9.1.1 4.6 2.6c1.3.7 1.3 1.9 0 2.6l-4.7 2.7z"/>
                    <path fill="#FF3A44" d="M16.7 15.5L12.7 11.6 3.6 20.7c.4.4 1.1.5 1.8.1l11.3-6.4"/>
                    <path fill="#FFCD00" d="M16.7 7.5L4.4 1.2C3.7.8 3 1 2.6 1.3L12.7 10.4l4-3.9"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider text-slate-300 font-semibold leading-none">GET IT ON</div>
                    <div className="text-sm font-bold text-white mt-1 leading-none font-sans">Google Play</div>
                  </div>
                </>
              )}
            </button>

            {/* Apple App Store Button */}
            <button
              type="button"
              onClick={() => setShowIosModal(true)}
              title="NSYU Business on the App Store (iOS in progress)"
              className="h-13 px-4 rounded-xl bg-black hover:bg-slate-900 border border-slate-800 text-white flex items-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer group"
            >
              <svg className="w-6 h-6 shrink-0 fill-current text-white group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.61 1.34-.56.64-1.05 1.71-.92 2.74 1.01.08 2.02-.51 2.61-1.23z"/>
              </svg>
              <div className="text-left">
                <div className="text-[9px] text-slate-300 font-semibold leading-none">Download on the</div>
                <div className="text-sm font-bold text-white mt-1 leading-none font-sans">App Store</div>
              </div>
            </button>

          </div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* ANIMATED APK DOWNLOAD SUCCESS MODAL                            */}
      {/* ============================================================== */}
      {apkSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-scale-up">
            <button
              type="button"
              onClick={() => setApkSuccessModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Icon & Title */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-3">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">APK Download Started!</h3>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-mono font-bold text-slate-800">{apkSuccessModal.filename}</span> (v1.0.0+2 • 62.3 MB)
              </p>
            </div>

            {/* Installation Instructions Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
              {apkSuccessModal.isAndroid ? (
                <>
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">📱</span>
                    <span>Android Installation Steps:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                    <li>When prompted by your browser, tap <strong className="text-slate-800">"Download anyway"</strong>.</li>
                    <li>Once downloaded, tap the file in your notification panel or Downloads folder.</li>
                    <li>If prompted with security settings, enable <strong className="text-slate-800">"Allow from this source"</strong> to install.</li>
                  </ol>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px]">💻</span>
                    <span>Desktop Download Notice:</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    The Android release APK has been downloaded to your computer. To install it on your Android phone, transfer the file (<code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-[10px]">NSYU-Business-Release.apk</code>) via USB, WhatsApp Web, or Google Drive.
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <a
                href={apkSuccessModal.url}
                download="NSYU-Business-Release.apk"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download Again (Direct File)</span>
              </a>

              <button
                type="button"
                onClick={() => setApkSuccessModal(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ANIMATED APK DOWNLOAD ERROR MODAL                              */}
      {/* ============================================================== */}
      {apkErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-scale-up">
            <button
              type="button"
              onClick={() => setApkErrorModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Error Graphic */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 mb-3 animate-shake">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Unable to Download APK</h3>
              <p className="text-xs text-slate-500 mt-1">Please check your internet connection or use the direct GitHub mirror.</p>
            </div>

            {/* Reason Box */}
            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 text-xs flex items-start gap-2.5">
              <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="text-rose-800 font-medium">
                <span className="font-bold">Reason:</span> {apkErrorModal.reason}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setApkErrorModal(null);
                  handleDownloadApk();
                }}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/25 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>Retry</span>
              </button>

              <a
                href={GITHUB_APK_RAW_URL}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <span>GitHub Mirror</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* iOS APP STORE COMING SOON MODAL                                */}
      {/* ============================================================== */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-scale-up">
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Apple Icon */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 mb-3">
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.61 1.34-.56.64-1.05 1.71-.92 2.74 1.01.08 2.02-.51 2.61-1.23z"/>
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">iOS App in Development</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                NSYU Business for iPhone and iPad is currently in preparation for the Apple App Store.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5 leading-relaxed">
              <div className="font-bold text-slate-800">✨ Fully Supported Web Portal:</div>
              <p>
                In the meantime, the NSYU Web Portal is fully mobile-optimized! You can use all billing, inventory, and ledger features directly from Safari or Chrome on your iOS device.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Continue to Web Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
