import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const [identifier, setIdentifier] = useState("nsyu.mnt@gmail.com");
  const [password, setPassword] = useState("Password@123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
  const [regShopCode, setRegShopCode] = useState("NSYU-01");
  const [regAddress, setRegAddress] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  // Backend / Supabase Connection Dialog State
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline" | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  // APK Download States
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [apkSuccessModal, setApkSuccessModal] = useState<{ isAndroid: boolean; filename: string; url: string } | null>(null);
  const [apkErrorModal, setApkErrorModal] = useState<{ reason: string } | null>(null);
  const [showIosModal, setShowIosModal] = useState(false);

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
    if (tab === "customer") {
      setIdentifier("");
      setPassword("");
    } else {
      setIdentifier("nsyu.mnt@gmail.com");
      setPassword("Password@123");
    }
  };

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
        setStatusMsg(json?.database ? `Connected (${json.database})` : "API Online & Supabase Connected");
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
            setError(`Cannot reach local server at ${apiUrl}. Please switch to "24/7 Cloud (Render)" in Database Settings.`);
          } else {
            setError(`Connecting to Cloud API (${apiUrl}). Free-tier cloud backend may take 30-40s to wake up. Please click the green pill below to check.`);
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

    if (!regName.trim() || !regPhone.trim() || !regEmail.trim()) {
      setRegError("Full Name, Mobile Number, and Email are required.");
      return;
    }

    setRegLoading(true);
    try {
      const res = await portalApi.post("/customer-portal/auth/register", {
        shopCode: regShopCode.trim() || "NSYU-01",
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

  return (
    <div className="min-h-screen bg-white text-[#142B4D] flex flex-col justify-between font-sans relative overflow-x-hidden select-none">
      
      {/* ── Soft Ambient Background Shapes (Pure White Theme with Subtle Light Blue Accents) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-Left Soft Radial Wave */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-[#E2EFFF] to-[#F5F9FF] opacity-80 blur-2xl" />
        {/* Top-Right Soft Radial Wave */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-bl from-[#EBF3FE] to-[#F8FAFC] opacity-70 blur-2xl" />
        {/* Bottom-Left Wave Accent */}
        <div className="absolute -bottom-36 -left-20 w-[420px] h-[360px] rounded-full bg-[#EDF5FF]/80 blur-3xl" />
        {/* Bottom-Right Soft Wave Accent */}
        <div className="absolute -bottom-40 -right-20 w-[480px] h-[400px] rounded-full bg-[#EBF3FF]/90 blur-3xl" />
      </div>

      {/* ── Main Scrollable Container ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-10">
        
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HEADER BRANDING & LOGO (Exact matching Reference Design)          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-center text-center mb-6">
          
          {/* Logo in Clean Rounded White Card with Soft Subtle Shadow */}
          <div className="w-[82px] h-[82px] rounded-[22px] bg-white p-2.5 shadow-[0_10px_25px_-5px_rgba(40,120,232,0.14),0_2px_6px_rgba(40,120,232,0.06)] border border-[#EBF2FA] flex items-center justify-center transition-transform hover:scale-105 duration-200">
            <img
              src="./nsyu_logo.png"
              alt="NSYU Logo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Heading: NSYU Business */}
          <h1 className="text-[32px] sm:text-[34px] font-extrabold text-[#142B4D] tracking-tight mt-3.5 leading-none">
            NSYU Business
          </h1>

          {/* Subtitle: —— Manage Your Business Easily —— */}
          <div className="flex items-center justify-center gap-3 mt-2 text-[#64748B]">
            <span className="w-8 h-[1.5px] bg-[#CBD5E1] rounded-full" />
            <span className="text-[13px] font-medium tracking-wide">Manage Your Business Easily</span>
            <span className="w-8 h-[1.5px] bg-[#CBD5E1] rounded-full" />
          </div>

          {/* 3 Compact Business Features Highlights */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-6">
            
            {/* 1: Sales & Billing */}
            <div className="flex flex-col items-center group">
              <div className="w-[52px] h-[52px] rounded-2xl bg-[#DCEBFF] flex items-center justify-center text-[#2878E8] shadow-xs transition-transform group-hover:scale-105">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <span className="text-[12.5px] font-bold text-[#142B4D] mt-2 tracking-tight">Sales & Billing</span>
            </div>

            {/* Divider */}
            <div className="w-px h-10 bg-[#E2E8F0]" />

            {/* 2: Inventory */}
            <div className="flex flex-col items-center group">
              <div className="w-[52px] h-[52px] rounded-2xl bg-[#DCEBFF] flex items-center justify-center text-[#2878E8] shadow-xs transition-transform group-hover:scale-105">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <span className="text-[12.5px] font-bold text-[#142B4D] mt-2 tracking-tight">Inventory</span>
            </div>

            {/* Divider */}
            <div className="w-px h-10 bg-[#E2E8F0]" />

            {/* 3: Customers */}
            <div className="flex flex-col items-center group">
              <div className="w-[52px] h-[52px] rounded-2xl bg-[#DCEBFF] flex items-center justify-center text-[#2878E8] shadow-xs transition-transform group-hover:scale-105">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span className="text-[12.5px] font-bold text-[#142B4D] mt-2 tracking-tight">Customers</span>
            </div>

          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 3-COLUMN WORKSPACE: LEFT SHOP | CENTER CARD | RIGHT DASHBOARD     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className="w-full max-w-6xl flex items-center justify-center gap-6 lg:gap-10 xl:gap-14">

          {/* ── Left Illustration: 3D Modern Retail Shop, Boxes & Plants (Desktop) ── */}
          <div className="hidden lg:flex flex-col items-end justify-center flex-1 max-w-[280px] xl:max-w-[320px] pointer-events-none select-none">
            <img
              src="./illustrations/retail_shop.png"
              alt="NSYU Retail Shop Illustration"
              className="w-full max-h-[360px] object-contain drop-shadow-sm mix-blend-multiply"
              style={{
                maskImage: "radial-gradient(ellipse 94% 94% at 50% 50%, black 72%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 94% 94% at 50% 50%, black 72%, transparent 100%)",
              }}
            />
          </div>

          {/* ── Center Column: Premium White Authentication Card ── */}
          <div className="w-full max-w-[430px]">
            <div className="bg-white rounded-[28px] shadow-[0_20px_50px_-15px_rgba(20,43,77,0.08),0_4px_15px_-4px_rgba(40,120,232,0.05)] p-6 sm:p-7 border border-[#E8EFF8] relative">
              
              {/* ── Segmented Pill Tabs ── */}
              <div className="bg-[#F1F5F9] p-1 rounded-2xl flex items-center gap-1">
                
                {/* Staff / Owner Tab */}
                <button
                  type="button"
                  id="staff-tab-btn"
                  onClick={() => handleTabChange("staff")}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === "staff"
                      ? "bg-[#2878E8] text-white shadow-md shadow-blue-500/25"
                      : "text-[#64748B] hover:text-[#142B4D]"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Staff / Owner</span>
                </button>

                {/* Customer Portal Tab */}
                <button
                  type="button"
                  id="customer-tab-btn"
                  onClick={() => handleTabChange("customer")}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === "customer"
                      ? "bg-[#2878E8] text-white shadow-md shadow-blue-500/25"
                      : "text-[#64748B] hover:text-[#142B4D]"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <polyline points="17 11 19 13 23 9" />
                  </svg>
                  <span>Customer Portal</span>
                </button>

              </div>

              {/* ── Customer Portal Informational Banner (Shown in Customer mode) ── */}
              {activeTab === "customer" && (
                <div className="mt-4 p-3 rounded-2xl bg-[#F0F6FE] border border-[#BFDBFE]/70 flex items-start gap-3 animate-fadeIn">
                  <div className="w-8 h-8 rounded-xl bg-[#DCEBFF] text-[#2878E8] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-[13px] text-[#142B4D]">Customer Portal</div>
                    <div className="text-[11.5px] text-[#64748B] leading-snug mt-0.5">
                      Log in with your registered phone or email to view your bills, payments and ledger.
                    </div>
                  </div>
                </div>
              )}

              {/* ── Form Error Notice ── */}
              {error && (
                <div className="mt-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="leading-tight">{error}</span>
                </div>
              )}

              {/* ── Main Login Form ── */}
              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                
                {/* Field 1: Identifier (Email / Username or Phone) */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <input
                    id="identifier-input"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={activeTab === "customer" ? "Email / Mobile Number" : "Email / Username"}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#E2E8F0] bg-white font-medium text-[#142B4D] text-[13.5px] placeholder-[#94A3B8] focus:border-[#2878E8] focus:outline-none focus:ring-4 focus:ring-[#2878E8]/10 transition-all"
                  />
                </div>

                {/* Field 2: Password (with Eye Toggle) */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    required={activeTab === "staff"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#E2E8F0] bg-white font-medium text-[#142B4D] text-[13.5px] placeholder-[#94A3B8] focus:border-[#2878E8] focus:outline-none focus:ring-4 focus:ring-[#2878E8]/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#64748B] cursor-pointer"
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

                {/* Remember me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-[#2878E8] focus:ring-[#2878E8] h-3.5 w-3.5"
                    />
                    <span className="text-[#142B4D] font-semibold text-[12.5px]">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[#2878E8] hover:underline font-bold text-[12.5px] cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Solid Professional Blue Login Button */}
                <button
                  type="submit"
                  id="login-submit-btn"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#2878E8] hover:bg-[#1E6CE0] active:scale-[0.99] disabled:opacity-60 text-white font-bold text-[14.5px] shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-1"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  )}
                  <span>{loading ? "Signing in…" : "Login"}</span>
                </button>

                {/* "or" Divider */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#E2E8F0]" />
                  <span className="text-[12px] text-[#94A3B8] font-medium">or</span>
                  <div className="flex-1 h-px bg-[#E2E8F0]" />
                </div>

                {/* Outlined Blue Create Account Button */}
                <button
                  type="button"
                  id="create-account-btn"
                  onClick={() => setShowRegisterModal(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-[#2878E8] hover:bg-[#F5F9FF] text-[#2878E8] font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  <span>Create Account</span>
                </button>

                {/* Supabase Connection Status Pill (Clickable for API / Database Settings) */}
                <button
                  type="button"
                  id="supabase-status-pill"
                  onClick={() => setShowApiModal(true)}
                  title="Click to view API Server & Supabase Database Configuration"
                  className="w-full mt-4 py-2 px-3.5 rounded-full bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#86EFAC]/80 flex items-center justify-between text-[11.5px] font-semibold text-[#166534] transition-all cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${apiStatus === "offline" ? "bg-rose-500" : "bg-[#16A34A] animate-pulse"}`} />
                    <span>
                      {apiStatus === "offline" ? "Supabase Offline (Click to config)" : "Supabase PostgreSQL Connected"}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-[#16A34A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </button>

              </form>

            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* APK DOWNLOAD BUTTON (Matching Reference UI)                      */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={handleDownloadApk}
                className="px-5 py-2 rounded-full bg-[#EBF3FF] hover:bg-[#DCEBFF] text-[#2878E8] text-[12px] font-bold flex items-center gap-2 border border-[#BFDBFE]/80 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <svg className="w-3.5 h-3.5 text-[#2878E8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download Android APK (v1.0)</span>
              </button>
            </div>

          </div>

          {/* ── Right Illustration: 3D Modern Analytics Dashboard & Monitor (Desktop) ── */}
          <div className="hidden lg:flex flex-col items-start justify-center flex-1 max-w-[280px] xl:max-w-[320px] pointer-events-none select-none">
            <img
              src="./illustrations/business_analytics.png"
              alt="NSYU Business Analytics Dashboard Illustration"
              className="w-full max-h-[360px] object-contain drop-shadow-sm mix-blend-multiply"
              style={{
                maskImage: "radial-gradient(ellipse 94% 94% at 50% 50%, black 72%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 94% 94% at 50% 50%, black 72%, transparent 100%)",
              }}
            />
          </div>

        </div>

      </div>

      {/* ── Bottom Ambient Corner Curve ── */}
      <div className="relative w-full h-8 pointer-events-none overflow-hidden z-0" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CUSTOMER OTP VERIFICATION MODAL                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center pt-1">
              <div className="w-12 h-12 rounded-2xl bg-[#DCEBFF] text-[#2878E8] flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-[#142B4D]">Enter Verification Code</h3>
              <p className="text-xs text-[#64748B] mt-1">
                A 4-digit code was sent to {maskedEmail ? <strong className="text-[#142B4D]">{maskedEmail}</strong> : "your registered email"}.
              </p>
            </div>

            {otpError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs text-center font-medium">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  autoFocus
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-full py-3 text-center text-2xl font-mono tracking-widest rounded-xl border border-slate-300 focus:border-[#2878E8] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpCode.length !== 4}
                className="w-full py-2.5 bg-[#2878E8] hover:bg-[#1E6CE0] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer"
              >
                {otpLoading ? "Verifying…" : "Verify & Login"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={otpCooldown > 0}
                  onClick={() => handleSubmit(new Event("submit") as any)}
                  className="text-xs text-[#2878E8] hover:underline font-semibold disabled:text-slate-400 cursor-pointer"
                >
                  {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : "Didn't receive code? Resend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: CUSTOMER CREATE ACCOUNT REGISTRATION                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              id="close-register-modal"
              onClick={() => setShowRegisterModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center pt-1">
              <div className="w-12 h-12 rounded-2xl bg-[#DCEBFF] text-[#2878E8] flex items-center justify-center mx-auto mb-2 shadow-xs">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-[#142B4D]">Create Customer Account</h3>
              <p className="text-xs text-[#64748B] mt-0.5">Register to access your bills, receipts and catalog online</p>
            </div>

            {regError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
                {regError}
              </div>
            )}

            {regSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                {regSuccess}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#142B4D] mb-1">Shop Code *</label>
                <input
                  type="text"
                  required
                  value={regShopCode}
                  onChange={(e) => setRegShopCode(e.target.value.toUpperCase())}
                  placeholder="NSYU-01"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs uppercase focus:border-[#2878E8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#142B4D] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#2878E8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#142B4D] mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#2878E8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#142B4D] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#2878E8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#142B4D] mb-1">Address (Optional)</label>
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="City, State"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#2878E8] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-2.5 bg-[#2878E8] hover:bg-[#1E6CE0] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer mt-2"
              >
                {regLoading ? "Registering…" : "Register & Send OTP"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: BACKEND API & SUPABASE STATUS CONFIGURATION              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <button
              type="button"
              id="close-api-modal"
              onClick={() => setShowApiModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex items-center gap-3 pt-1">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#142B4D]">Supabase & API Configuration</h3>
                <p className="text-xs text-[#64748B]">Live backend server and database status</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">PostgreSQL Host:</span>
                <span className="font-mono font-semibold text-[#142B4D] text-[11px]">aws-0-ap-south-1.pooler.supabase.com</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Database Name:</span>
                <span className="font-mono font-semibold text-emerald-700">postgres.lggjtxzannywecuvwqbl</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">API Health:</span>
                <span className="font-semibold text-emerald-600">{statusMsg || "Checking..."}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-[#142B4D]">Backend API Endpoint</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveApiUrl(DEFAULT_CLOUD_API_URL)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    apiUrl === DEFAULT_CLOUD_API_URL
                      ? "bg-[#2878E8] text-white border-[#2878E8] shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  ☁️ 24/7 Cloud (Render)
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveApiUrl(DEFAULT_LOCAL_API_URL)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    apiUrl === DEFAULT_LOCAL_API_URL
                      ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  💻 Localhost
                </button>
              </div>

              <div className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono focus:border-[#2878E8] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveApiUrl(apiUrl)}
                  className="px-3 py-1.5 bg-[#2878E8] text-white rounded-xl font-bold hover:bg-[#1E6CE0] text-xs shrink-0 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => checkHealth(apiUrl)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Test Connection
              </button>
              <button
                type="button"
                onClick={() => setShowApiModal(false)}
                className="flex-1 py-2 bg-[#2878E8] hover:bg-[#1E6CE0] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: FORGOT PASSWORD HELPER MODAL                            */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setForgotMsg(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center pt-1">
              <div className="w-12 h-12 rounded-2xl bg-[#DCEBFF] text-[#2878E8] flex items-center justify-center mx-auto mb-2 shadow-xs">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-[#142B4D]">Forgot Password?</h3>
              <p className="text-xs text-[#64748B] mt-0.5">Contact system administrator or request password assistance</p>
            </div>

            {forgotMsg ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl">
                {forgotMsg}
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  To reset your password, an authorization verification link will be sent to your registered email address.
                </p>
                <button
                  type="button"
                  onClick={() => setForgotMsg(`Password assistance instruction sent to ${identifier || "nsyu.mnt@gmail.com"}.`)}
                  className="w-full py-2.5 bg-[#2878E8] hover:bg-[#1E6CE0] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  Send Reset Link
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setForgotMsg(null);
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 5: APK DOWNLOAD SUCCESS & ERROR MODALS                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {apkSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <button
              type="button"
              onClick={() => setApkSuccessModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center pt-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-[#142B4D]">APK Download Started</h3>
              <p className="text-xs text-[#64748B] mt-0.5">NSYU-Business-Release.apk (v1.0 • 62.4 MB)</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-[#142B4D]">📱 Installation Note:</div>
              <div>When prompted by your browser, tap <strong>"Download anyway"</strong>, then tap the file to install.</div>
            </div>

            <button
              type="button"
              onClick={() => setApkSuccessModal(null)}
              className="w-full py-2 bg-[#2878E8] hover:bg-[#1E6CE0] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {apkErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <button
              type="button"
              onClick={() => setApkErrorModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center pt-1">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-[#142B4D]">Download Error</h3>
              <p className="text-xs text-[#64748B] mt-0.5">{apkErrorModal.reason}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setApkErrorModal(null);
                  handleDownloadApk();
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Retry
              </button>
              <a
                href={GITHUB_APK_RAW_URL}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs text-center transition-colors"
              >
                Direct Link
              </a>
            </div>
          </div>
        </div>
      )}

      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center pt-1">
              <h3 className="text-lg font-extrabold text-[#142B4D]">iOS App in Development</h3>
              <p className="text-xs text-[#64748B] mt-1">
                You can use the full NSYU Web Portal right from Safari or Chrome on your iPhone or iPad!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-2 bg-[#2878E8] hover:bg-[#1E6CE0] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
