import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { apiErrorMessage, getApiBaseUrl, setApiBaseUrl, DEFAULT_CLOUD_API_URL, DEFAULT_LOCAL_API_URL } from "../api/client";
import { requestOtpApi, verifyOtpApi, portalApi } from "../api/portal";
import { useAuthStore } from "../store/authStore";
import { usePortalStore } from "../store/portalStore";

const GITHUB_APK_RAW_URL = "https://github.com/nsyumnt-rgb/nsyu/raw/main/App/downloads/nsyu-business-release.apk";
const LOCAL_APK_URL = "./downloads/nsyu-business-release.apk";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const setCustomerSession = usePortalStore((s) => s.setCustomerSession);

  // Tab State: "staff" | "customer"
  const [activeTab, setActiveTab] = useState<"staff" | "customer">("staff");

  // Form Inputs
  // Never pre-fill credentials: this page is public.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Customer OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Create Account / Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regShopCode, setRegShopCode] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Backend / Supabase Connection Dialog State
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline" | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  // APK Download States
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [apkSuccessModal, setApkSuccessModal] = useState<{ isAndroid: boolean; filename: string; url: string } | null>(null);
  const [apkErrorModal, setApkErrorModal] = useState<{ reason: string } | null>(null);

  // Cooldown countdown
  useEffect(() => {
    let timer: any;
    if (otpCooldown > 0) {
      timer = setInterval(() => setOtpCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Update default inputs when switching tabs
  const handleTabChange = (tab: "staff" | "customer") => {
    setActiveTab(tab);
    setError(null);
    setIdentifier("");
    setPassword("");
  };

  const checkHealth = async (testUrl?: string) => {
    const target = (testUrl || apiUrl).trim().replace(/\/$/, "");
    setApiStatus("checking");
    setStatusMsg("Checking connection…");
    try {
      const healthEndpoint = target.endsWith("/api") ? `${target}/health` : `${target}/api/health`;
      const res = await fetch(healthEndpoint, { method: "GET" });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        setApiStatus("online");
        setStatusMsg(json?.database ? `Online · database ${json.database}` : "Online");
      } else {
        setApiStatus("offline");
        setStatusMsg(`Server returned status ${res.status}`);
      }
    } catch {
      setApiStatus("offline");
      setStatusMsg("Unable to reach the server");
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

  // Main Login Form Submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError(activeTab === "customer" ? "Please enter your Email or Mobile Number." : "Please enter your Email or Username.");
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // STAFF / OWNER LOGIN FLOW
    // ─────────────────────────────────────────────────────────────
    if (activeTab === "staff") {
      if (!password) {
        setError("Please enter your password.");
        return;
      }

      setLoading(true);
      try {
        const res = await loginApi(identifier.trim(), password);
        const data = res.data.data!;
        setSession(data.accessToken, data.refreshToken, data.accountType);

        if ((data as any).shop) {
          setActiveShop((data as any).shop);
        }

        if ((data as any).accountType === "super_admin" || (data as any).isSuperAdmin) {
          navigate("/admin");
        } else {
          navigate("/app");
        }
      } catch (err: any) {
        const baseErr = apiErrorMessage(err, "Invalid email or password. Please try again.");
        if (err.message && err.message.toLowerCase().includes("network error")) {
          if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
            setError(`Cannot reach the local server at ${apiUrl}. Switch to the cloud server in Server settings.`);
          } else {
            setError("The server is waking up — this can take 30–40 seconds. Please try again shortly.");
          }
          setShowApiModal(true);
        } else {
          setError(baseErr);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // CUSTOMER PORTAL LOGIN FLOW
    // ─────────────────────────────────────────────────────────────
    const cleanId = identifier.trim();
    setLoading(true);
    try {
      const res = await requestOtpApi(cleanId);
      setMaskedEmail(res.maskedEmail || null);
      setShowOtpModal(true);
      setOtpCooldown(60);
      setOtpError(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to find customer account.";
      if (err.response?.status === 404) {
        setError("Account not found. Click 'Create Account' below to register.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // Customer OTP Verification
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    if (!otpCode || otpCode.trim().length !== 4) {
      setOtpError("Please enter the 4-digit code.");
      return;
    }

    setOtpLoading(true);
    try {
      const res = await verifyOtpApi(identifier.trim(), otpCode.trim());
      const { accessToken, refreshToken, customer } = res.data;
      setCustomerSession(accessToken, refreshToken, customer);
      setShowOtpModal(false);
      navigate("/portal/home", { replace: true });
    } catch (err: any) {
      setOtpError(err.response?.data?.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  // Customer Registration Submission
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    if (!regShopCode.trim() || !regName.trim() || !regPhone.trim() || !regEmail.trim()) {
      setRegError("Shop code, full name, mobile number and email are required.");
      return;
    }

    setRegLoading(true);
    try {
      const res = await portalApi.post("/customer-portal/auth/register", {
        shopCode: regShopCode.trim(),
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        address: regAddress.trim() || undefined,
      });

      setRegSuccess(res.data?.message || "Account registered successfully! A 4-digit verification code was sent to your email.");
      setIdentifier(regPhone.trim() || regEmail.trim());
      setTimeout(() => {
        setShowRegisterModal(false);
        setActiveTab("customer");
        setShowOtpModal(true);
        setOtpCooldown(60);
      }, 1200);
    } catch (err: any) {
      setRegError(err.response?.data?.message || "Registration failed. Please check your shop code and phone number.");
    } finally {
      setRegLoading(false);
    }
  }

  // APK Download Trigger
  async function handleDownloadApk() {
    if (isDownloadingApk) return;
    setIsDownloadingApk(true);

    const isAndroid = /Android/i.test(navigator.userAgent);
    let downloadUrl = LOCAL_APK_URL;

    try {
      try {
        const res = await fetch(LOCAL_APK_URL, { method: "HEAD" });
        if (!res.ok) downloadUrl = GITHUB_APK_RAW_URL;
      } catch {
        downloadUrl = GITHUB_APK_RAW_URL;
      }

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "NSYU-Business-Release.apk";
      link.setAttribute("target", "_blank");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

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


  const isCustomer = activeTab === "customer";
  const statusDot = apiStatus === "online" ? "bg-emerald-500" : apiStatus === "offline" ? "bg-rose-500" : "bg-amber-400 animate-pulse";
  const statusText = apiStatus === "online" ? "Server online" : apiStatus === "offline" ? "Server unreachable" : "Checking server…";

  return (
    <div className="min-h-[100dvh] bg-white text-navy-900 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ── Brand panel (desktop) ── */}
      <aside
        className="hidden lg:flex relative flex-col justify-between overflow-hidden p-10 xl:p-14 text-white"
        style={{ background: "radial-gradient(120% 90% at 100% 0%, #16A06A 0%, rgba(22,160,106,0) 55%), linear-gradient(150deg, #04261D 0%, #064E3B 60%, #047857 100%)" }}
      >
        <div aria-hidden className="absolute -bottom-40 -left-24 w-[520px] h-[520px] rounded-full border border-white/10" />
        <div aria-hidden className="absolute -bottom-24 -left-8 w-[360px] h-[360px] rounded-full border border-white/10" />

        <Link to="/" className="relative inline-flex items-center gap-3 w-fit">
          <span className="w-11 h-11 rounded-xl bg-white p-1.5 shadow-lg"><img src="./nsyu_logo.png" alt="" className="w-full h-full object-contain" /></span>
          <span className="text-[19px] font-bold tracking-tight">NSYU Business</span>
        </Link>

        <div className="relative max-w-[460px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-200/90">Shop management</p>
          <h2 className="mt-3 text-[34px] xl:text-[40px] font-bold leading-[1.12] tracking-tight !text-white">Run your whole shop from one place.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-emerald-50/80">Billing, stock, suppliers, customer khata and online orders — on the web and on your phone.</p>
          <ul className="mt-9 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.t} className="flex items-start gap-4">
                <span className="w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.i}</svg>
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{f.t}</span>
                  <span className="block text-[13px] text-emerald-50/70 mt-0.5">{f.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 text-[12.5px] text-emerald-50/70">
          <span>© {new Date().getFullYear()} NSYU</span>
          <Link to="/" className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-emerald-200">
            Browse the marketplace
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="min-h-[100dvh] flex flex-col bg-white lg:bg-slate-50/60">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
          <Link to="/" className="lg:invisible inline-flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-white p-1 ring-1 ring-slate-200 shadow-xs"><img src="./nsyu_logo.png" alt="" className="w-full h-full object-contain" /></span>
            <span className="text-[16px] font-bold tracking-tight">NSYU Business</span>
          </Link>
          <Link to="/" className="text-[13px] font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 min-h-[40px]">
            Marketplace
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        </header>

        <div className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-8 pb-8 pt-2 sm:pt-0">
          <div className="w-full max-w-[420px]">
            <div className="lg:bg-white lg:rounded-2xl lg:ring-1 lg:ring-slate-200/80 lg:shadow-[0_24px_60px_-28px_rgba(4,38,29,0.25)] lg:p-8">
              <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight leading-tight">Welcome back</h1>
              <p className="mt-1.5 text-[14px] text-slate-500">
                {isCustomer ? "Sign in with a one-time code to see your bills, orders and khata." : "Sign in to manage your shop."}
              </p>

              <div role="tablist" aria-label="Account type" className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {TABS.map((t) => (
                  <button
                    key={t.k}
                    id={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === t.k}
                    onClick={() => handleTabChange(t.k)}
                    className={`min-h-[42px] rounded-lg text-[13.5px] font-semibold transition-all ${activeTab === t.k ? "bg-white text-navy-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-navy-900"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {error && (
                <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] text-rose-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                <div>
                  <label htmlFor="identifier-input" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                    {isCustomer ? "Mobile number or email" : "Email or username"}
                  </label>
                  <input
                    id="identifier-input"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete={isCustomer ? "tel" : "username"}
                    placeholder={isCustomer ? "98765 43210 or you@example.com" : "you@business.com"}
                    className={FIELD}
                  />
                </div>

                {!isCustomer && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="password-input" className="text-[13px] font-semibold text-slate-700">Password</label>
                      <button type="button" onClick={() => setShowForgotModal(true)} className="text-[13px] font-semibold text-brand-700 hover:text-brand-800">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password-input"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className={`${FIELD} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        ) : (
                          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" id="login-submit-btn" disabled={loading} className={`${PRIMARY} w-full h-12 text-[15px]`}>
                  {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {loading ? (isCustomer ? "Sending code…" : "Signing in…") : isCustomer ? "Send login code" : "Sign in"}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-200 text-center text-[13.5px] text-slate-500">
                {isCustomer ? (
                  <>
                    New customer?{" "}
                    <button type="button" id="create-account-btn" onClick={() => setShowRegisterModal(true)} className="font-semibold text-brand-700 hover:text-brand-800">
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    New business?{" "}
                    <Link to="/register" id="create-account-btn" className="font-semibold text-brand-700 hover:text-brand-800">
                      Register your shop
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12.5px] text-slate-500">
              <button type="button" id="supabase-status-pill" onClick={() => setShowApiModal(true)} className="inline-flex items-center gap-2 min-h-[36px] hover:text-navy-900" title="Server settings">
                <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                {statusText}
              </button>
              <span className="text-slate-300" aria-hidden>•</span>
              <button type="button" onClick={handleDownloadApk} disabled={isDownloadingApk} className="inline-flex items-center gap-1.5 min-h-[36px] hover:text-navy-900 disabled:opacity-60">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                {isDownloadingApk ? "Preparing…" : "Get the Android app"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── OTP verification ── */}
      {showOtpModal && (
        <Modal
          onClose={() => setShowOtpModal(false)}
          title="Enter your code"
          subtitle={<>We sent a 4-digit code to {maskedEmail ? <strong className="text-navy-900">{maskedEmail}</strong> : "your registered email"}.</>}
        >
          {otpError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 text-center">{otpError}</p>}
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              autoFocus
              required
              aria-label="4-digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full h-14 rounded-xl border border-slate-300 text-center text-2xl font-mono tracking-[0.6em] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
            <button type="submit" disabled={otpLoading || otpCode.length !== 4} className={`${PRIMARY} w-full h-12 text-[15px]`}>
              {otpLoading ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              disabled={otpCooldown > 0}
              onClick={() => handleSubmit(new Event("submit") as any)}
              className="w-full min-h-[40px] text-[13px] font-semibold text-brand-700 hover:text-brand-800 disabled:text-slate-400"
            >
              {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : "Didn't get it? Resend code"}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Customer registration ── */}
      {showRegisterModal && (
        <Modal onClose={() => setShowRegisterModal(false)} closeId="close-register-modal" title="Create customer account" subtitle="Register with your shop to see bills, orders and khata online." wide>
          {regError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">{regError}</p>}
          {regSuccess && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">{regSuccess}</p>}
          <form onSubmit={handleRegister} className="grid sm:grid-cols-2 gap-3.5">
            <RegField label="Shop code" id="reg-shop" className="sm:col-span-2" value={regShopCode} onChange={(v) => setRegShopCode(v.toUpperCase())} placeholder="Ask your shop for its code" inputClass="font-mono uppercase placeholder:font-sans placeholder:normal-case" />
            <RegField label="Full name" id="reg-name" className="sm:col-span-2" value={regName} onChange={setRegName} autoComplete="name" />
            <RegField label="Mobile number" id="reg-phone" type="tel" value={regPhone} onChange={setRegPhone} autoComplete="tel" inputMode="tel" />
            <RegField label="Email" id="reg-email" type="email" value={regEmail} onChange={setRegEmail} autoComplete="email" />
            <RegField label="Address (optional)" id="reg-address" className="sm:col-span-2" value={regAddress} onChange={setRegAddress} required={false} autoComplete="street-address" />
            <button type="submit" disabled={regLoading} className={`${PRIMARY} sm:col-span-2 mt-1 w-full h-12 text-[15px]`}>
              {regLoading ? "Registering…" : "Register & send code"}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Server settings ── */}
      {showApiModal && (
        <Modal onClose={() => setShowApiModal(false)} closeId="close-api-modal" title="Server settings" subtitle="Which NSYU server this app connects to.">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3.5 py-3 text-[13px] min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} />
            <span className="font-semibold text-navy-900 shrink-0">{statusText}</span>
            {statusMsg && apiStatus !== "checking" && <span className="text-slate-500 truncate">· {statusMsg}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { u: DEFAULT_CLOUD_API_URL, l: "Cloud" },
              { u: DEFAULT_LOCAL_API_URL, l: "This computer" },
            ].map((o) => (
              <button
                key={o.u}
                type="button"
                onClick={() => handleSaveApiUrl(o.u)}
                className={`min-h-[44px] rounded-xl text-[13px] font-semibold transition ${apiUrl === o.u ? "bg-brand-50 text-brand-800 ring-2 ring-brand-500" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="api-url" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Server address</label>
            <div className="flex gap-2">
              <input id="api-url" type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="input h-11 font-mono text-[12.5px] min-w-0" />
              <button type="button" onClick={() => handleSaveApiUrl(apiUrl)} className="btn-primary h-11 shrink-0">Save</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => checkHealth(apiUrl)} className="btn-secondary h-11">Test connection</button>
            <button type="button" onClick={() => setShowApiModal(false)} className="btn-primary h-11">Done</button>
          </div>
        </Modal>
      )}

      {/* ── Forgot password: there is no self-service owner reset endpoint, so give honest guidance ── */}
      {showForgotModal && (
        <Modal onClose={() => setShowForgotModal(false)} title="Forgot your password?" subtitle="Here's how to get back in.">
          <ul className="space-y-2.5 text-[13.5px] text-slate-600">
            <li className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3.5"><strong className="block text-navy-900">Staff</strong>Ask your shop owner to set a new password for you.</li>
            <li className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3.5"><strong className="block text-navy-900">Shop owner</strong>Contact NSYU support to verify your identity and reset it.</li>
            <li className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3.5"><strong className="block text-navy-900">Customer</strong>No password needed — use the Customer tab to sign in with a one-time code.</li>
          </ul>
          <button type="button" onClick={() => setShowForgotModal(false)} className="btn-primary w-full h-11">Back to sign in</button>
        </Modal>
      )}

      {/* ── APK download ── */}
      {apkSuccessModal && (
        <Modal onClose={() => setApkSuccessModal(null)} title="Download started" subtitle={apkSuccessModal.filename}>
          <p className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3.5 text-[13px] text-slate-600">
            {apkSuccessModal.isAndroid ? (
              <>If your browser warns you, tap <strong>Download anyway</strong>, then open the file to install.</>
            ) : (
              "Copy this file to an Android phone and open it there to install the app."
            )}
          </p>
          <button type="button" onClick={() => setApkSuccessModal(null)} className="btn-primary w-full h-11">Done</button>
        </Modal>
      )}
      {apkErrorModal && (
        <Modal onClose={() => setApkErrorModal(null)} title="Download failed" subtitle={apkErrorModal.reason}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setApkErrorModal(null); handleDownloadApk(); }} className="btn-secondary h-11">Try again</button>
            <a href={GITHUB_APK_RAW_URL} target="_blank" rel="noreferrer" className="btn-primary h-11">Direct link</a>
          </div>
        </Modal>
      )}
    </div>
  );
}

const FIELD = "w-full h-12 rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";
const PRIMARY = "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 text-white font-semibold shadow-brand transition";

const TABS = [
  { k: "staff", id: "staff-tab-btn", label: "Owner / Staff" },
  { k: "customer", id: "customer-tab-btn", label: "Customer" },
] as const;

const FEATURES = [
  { t: "Sales & billing", d: "GST invoices, POS and online orders in one queue", i: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></> },
  { t: "Inventory & purchases", d: "Live stock, low-stock alerts and supplier bills", i: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></> },
  { t: "Customers & khata", d: "Ledgers, dues and a portal for your customers", i: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> },
];

function Modal({ title, subtitle, onClose, closeId, wide, children }: { title: string; subtitle?: React.ReactNode; onClose: () => void; closeId?: string; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-navy-950/50 backdrop-blur-[2px] animate-fadeIn" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${wide ? "sm:max-w-lg" : "sm:max-w-sm"} max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4`}
      >
        <button type="button" id={closeId} onClick={onClose} aria-label="Close" className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
        <div className="pr-10">
          <h3 className="text-[18px] font-bold text-navy-900 tracking-tight">{title}</h3>
          {subtitle && <p className="mt-1 text-[13px] text-slate-500 break-words">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function RegField({
  label,
  id,
  value,
  onChange,
  className = "",
  inputClass = "",
  required = true,
  ...rest
}: { label: string; id: string; value: string; onChange: (v: string) => void; className?: string; inputClass?: string; required?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "className" | "id">) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[13px] font-semibold text-slate-700 mb-1.5">{label}</label>
      <input
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className={`w-full h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[14px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 ${inputClass}`}
      />
    </div>
  );
}
