import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { loginCustomerWithPasswordApi, requestOtpApi, verifyOtpApi, portalApi } from "../api/portal";
import { useAuthStore } from "../store/authStore";
import { usePortalStore } from "../store/portalStore";
import { apiErrorMessage } from "../api/client";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "customer" | "staff";
  onSuccess?: () => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  initialTab = "customer",
  onSuccess,
}: LoginModalProps) {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const setCustomerSession = usePortalStore((s) => s.setCustomerSession);

  const [activeTab, setActiveTab] = useState<"customer" | "staff">(initialTab);
  const [customerMode, setCustomerMode] = useState<"password" | "otp" | "register">("password");

  // Form Fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP Fields
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Registration Fields
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regAddress, setRegAddress] = useState("");

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError(null);
      setSuccessMsg(null);
      setIdentifier("");
      setPassword("");
      setOtpCode("");
      setOtpStep("request");
      setCustomerMode("password");
    }
  }, [isOpen, initialTab]);

  // OTP Countdown
  useEffect(() => {
    let timer: any;
    if (otpCooldown > 0) {
      timer = setInterval(() => setOtpCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // 1. Owner / Staff Login Handler
  // -------------------------------------------------------------
  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginApi(identifier.trim(), password);
      const data = res.data.data;
      if (data) {
        setSession(data.accessToken, data.refreshToken, data.accountType);
        if ((data as any).shop) {
          setActiveShop((data as any).shop);
        }
        onClose();
        if (onSuccess) {
          onSuccess();
        } else if (data.accountType === "super_admin" || (data as any).isSuperAdmin) {
          navigate("/admin");
        } else {
          navigate("/app");
        }
      }
    } catch (err: any) {
      setError(apiErrorMessage(err, "Login failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // 2. Customer Password Login Handler
  // -------------------------------------------------------------
  async function handleCustomerPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Please enter your mobile number/email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginCustomerWithPasswordApi(identifier.trim(), password);
      const { accessToken, refreshToken, customer } = res.data;
      setCustomerSession(accessToken, refreshToken, customer);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Invalid credentials. Try OTP login if you forgot password."));
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // 3. Customer OTP Request Handler
  // -------------------------------------------------------------
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId || !cleanId.includes("@")) {
      setError("Please enter your registered email address for 6-digit OTP verification.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtpApi(cleanId);
      setMaskedEmail(res.maskedEmail || cleanId);
      setOtpStep("verify");
      setOtpCooldown(60);
      setSuccessMsg("✓ 6-digit OTP code sent to your email.");
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError("Account not found. Click 'Create Account' below to register.");
      } else {
        setError(apiErrorMessage(err, "Failed to send OTP code."));
      }
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // 4. Customer OTP Verify Handler
  // -------------------------------------------------------------
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!otpCode || otpCode.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtpApi(identifier.trim(), otpCode.trim());
      const { accessToken, refreshToken, customer } = res.data;
      setCustomerSession(accessToken, refreshToken, customer);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Invalid or expired OTP code."));
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // 5. Customer Registration Handler
  // -------------------------------------------------------------
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!regName.trim() || !regPhone.trim() || !regEmail.trim()) {
      setError("Full name, mobile number, and email are required.");
      return;
    }

    setLoading(true);
    try {
      await portalApi.post("/customer-portal/auth/register", {
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        address: regAddress.trim() || undefined,
      });
      setSuccessMsg("✓ Account created! A 6-digit OTP has been sent to your email.");
      setIdentifier(regEmail.trim());
      setCustomerMode("otp");
      setOtpStep("verify");
      setOtpCooldown(60);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Dark Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Centered Modal Popup Card */}
      <div className="relative w-full max-w-[440px] bg-white rounded-3xl border border-border shadow-pop p-6 sm:p-8 z-10 space-y-5 animate-scale-in">
        
        {/* Modal Top Header with Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold shadow-xs">
              <svg className="w-5 h-5 text-[#047857]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-navy-900 tracking-tight leading-none">
                NSYU Sign In
              </h2>
              <span className="text-[10.5px] font-semibold text-emerald-700">
                Shop Smart · Shop Better
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Customer vs Shop Owner/Staff */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab("customer");
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "customer"
                ? "bg-[#047857] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>👤</span>
            <span>Customer Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("staff");
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "staff"
                ? "bg-[#047857] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🏪</span>
            <span>Owner & Staff</span>
          </button>
        </div>

        {/* Status / Error Alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: SHOP OWNER / STAFF LOGIN FORM                           */}
        {/* ============================================================== */}
        {activeTab === "staff" && (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Shop Owner / Staff Email
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="owner@business.com or staff@shop.com"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <a
                  href="#/login"
                  onClick={onClose}
                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your login password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#047857] hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In…</span>
                </>
              ) : (
                <span>Sign In as Owner / Staff →</span>
              )}
            </button>

            <div className="pt-2 text-center text-xs text-slate-500 font-medium">
              Want to register a new store?{" "}
              <a
                href="#/register"
                onClick={onClose}
                className="font-bold text-emerald-700 hover:underline"
              >
                Register Shop
              </a>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CUSTOMER LOGIN FORM                                     */}
        {/* ============================================================== */}
        {activeTab === "customer" && (
          <div className="space-y-4">
            
            {/* Mode Toggle: Password vs OTP vs Register */}
            {customerMode !== "register" && (
              <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode("password");
                      setError(null);
                    }}
                    className={`transition pb-1 ${
                      customerMode === "password"
                        ? "text-emerald-700 border-b-2 border-emerald-600"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Password Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode("otp");
                      setError(null);
                    }}
                    className={`transition pb-1 ${
                      customerMode === "otp"
                        ? "text-emerald-700 border-b-2 border-emerald-600"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Email OTP Sign In
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("register");
                    setError(null);
                  }}
                  className="text-emerald-700 hover:underline text-[11px]"
                >
                  + New Account
                </button>
              </div>
            )}

            {/* A. Password Login */}
            {customerMode === "password" && (
              <form onSubmit={handleCustomerPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number or Email
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="98765 43210 or customer@example.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your customer password"
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#047857] hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing In…</span>
                    </>
                  ) : (
                    <span>Sign In to Market →</span>
                  )}
                </button>
              </form>
            )}

            {/* B. OTP Login */}
            {customerMode === "otp" && (
              <form onSubmit={otpStep === "request" ? handleRequestOtp : handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={otpStep === "verify"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium disabled:opacity-60"
                  />
                </div>

                {otpStep === "verify" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      6-Digit OTP Code sent to {maskedEmail || "email"}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                      className="w-full py-2.5 text-center text-lg font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-bold"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (otpStep === "verify" && otpCode.length !== 6)}
                  className="w-full py-2.5 bg-[#047857] hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : otpStep === "request" ? (
                    <span>Send Verification Code →</span>
                  ) : (
                    <span>Verify Code & Sign In →</span>
                  )}
                </button>

                {otpStep === "verify" && (
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <button
                      type="button"
                      onClick={() => setOtpStep("request")}
                      className="hover:underline text-slate-600 font-medium"
                    >
                      ← Change Email
                    </button>
                    <button
                      type="button"
                      disabled={otpCooldown > 0}
                      onClick={handleRequestOtp}
                      className="font-bold text-emerald-700 hover:underline disabled:text-slate-400"
                    >
                      {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : "Resend code"}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* C. Registration */}
            {customerMode === "register" && (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-extrabold text-navy-900">Create Customer Account</span>
                  <button
                    type="button"
                    onClick={() => setCustomerMode("password")}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    ← Back to Login
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Email (for OTP verification) *</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Delivery Address (optional)</label>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="House / Flat, Landmark, City"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#047857] hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-sm mt-2"
                >
                  {loading ? "Registering…" : "Create Account & Send Code →"}
                </button>
              </form>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
