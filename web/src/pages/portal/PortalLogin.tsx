import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  loginCustomerWithPasswordApi,
  forgotPasswordApi,
  resetPasswordApi,
  requestOtpApi,
  verifyOtpApi,
  portalApi,
} from "../../api/portal";
import { usePortalStore } from "../../store/portalStore";
import AuthShell from "../../components/AuthShell";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Return to the marketplace page the customer came from (internal /market paths only — no open redirects).
  const nextParam = searchParams.get("next") || "";
  const afterLogin = /^\/market(\/|$)/.test(nextParam) && !nextParam.startsWith("//") ? nextParam : "/portal/home";
  const setCustomerSession = usePortalStore((s) => s.setCustomerSession);

  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [step, setStep] = useState<"login" | "otp" | "forgot" | "reset" | "register">("login");

  const [identifier, setIdentifier] = useState(
    searchParams.get("identifier") || searchParams.get("phone") || searchParams.get("email") || ""
  );
  const [shopCode, setShopCode] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration state
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regEmail, setRegEmail] = useState("");

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((c) => c - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  /* ---------------- Password Login ---------------- */
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError("Please enter your email or mobile number.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginCustomerWithPasswordApi(cleanId, password);
      const { accessToken, refreshToken, customer } = res.data;
      setCustomerSession(accessToken, refreshToken, customer);
      navigate(afterLogin, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Invalid credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Request OTP Login ---------------- */
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = identifier.trim().toLowerCase();
    if (!cleanInput || !cleanInput.includes("@")) {
      setError("Enter your registered email address. The 6-digit OTP is sent by email only.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtpApi(cleanInput);
      setSuccessMsg(res.message || "6-digit OTP sent to your registered email.");
      if (res.maskedEmail) {
        setMaskedEmail(res.maskedEmail);
      }
      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to send OTP.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Verify OTP Login ---------------- */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.trim().length !== 6) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtpApi(identifier.trim(), otp.trim());
      const { accessToken, refreshToken, customer } = res.data;
      setCustomerSession(accessToken, refreshToken, customer);
      navigate(afterLogin, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || "Invalid or expired OTP. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Forgot Password: Send OTP ---------------- */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = identifier.trim();
    if (!cleanInput || !cleanInput.includes("@")) {
      setError("Enter your registered email address. Password reset OTP is sent by email only.");
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPasswordApi(cleanInput);
      setSuccessMsg(res.message || "Verification code sent to your registered email.");
      if (res.maskedEmail) {
        setMaskedEmail(res.maskedEmail);
      }
      setStep("reset");
      setOtp("");
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Could not process password reset request.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Reset Password: Enter OTP & New Password ---------------- */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    if (!newPassword || newPassword.trim().length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordApi(identifier.trim(), otp.trim(), newPassword.trim());
      setSuccessMsg(res.message || "Password reset successfully! Please log in with your new password.");
      setPassword(newPassword);
      setStep("login");
      setAuthMode("password");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Self Registration ---------------- */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regName.trim() || !regPhone.trim() || !regEmail.trim()) {
      setError("Name, mobile number and email are required for registration.");
      return;
    }

    setLoading(true);
    try {
      const res = await portalApi.post("/customer-portal/auth/register", {
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        address: regAddress.trim() || undefined,
      });
      setIdentifier(regEmail.trim() || regPhone.trim());
      setSuccessMsg(res.data?.message || "Registration submitted successfully! Awaiting shop approval.");
      setStep("login");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Registration failed. Please check your details and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell variant="customer" headline="Everything you buy, in one place.">
      <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight leading-tight">
        {step === "register" ? "Create your account" : step === "forgot" || step === "reset" ? "Reset your password" : step === "otp" ? "Enter your code" : "Customer sign in"}
      </h1>
      <p className="mt-1.5 mb-5 text-[14px] text-slate-500">
        {step === "register" ? "Register with your shop to order online and see your khata." : step === "forgot" || step === "reset" ? "We'll send a one-time code to your registered email." : "Sign in to order, track deliveries and check your khata."}
      </p>
        {/* Content Body */}
        <div>
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[13px] flex items-start gap-2.5">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] flex items-start gap-2.5">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Mode Switcher (Password vs OTP) */}
          {step === "login" && (
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-[13.5px]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("password");
                  setError(null);
                }}
                className={`min-h-[42px] rounded-lg font-semibold transition ${
                  authMode === "password" ? "bg-white text-navy-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-navy-900"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("otp");
                  setError(null);
                }}
                className={`min-h-[42px] rounded-lg font-semibold transition ${
                  authMode === "otp" ? "bg-white text-navy-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-navy-900"
                }`}
              >
                One-time code
              </button>
            </div>
          )}

          {/* PASSWORD LOGIN FORM */}
          {step === "login" && authMode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Email or mobile number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    className="w-full px-3.5 h-12 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep("forgot");
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your customer password"
                    className="w-full pl-3.5 pr-12 h-12 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-gray-400 hover:text-gray-700 font-medium"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="hidden">
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Shop code <span className="text-gray-400 font-normal lowercase">(optional if registered)</span>
                </label>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SHOP01 or leave blank"
                  className="w-full h-12 px-3.5 text-[15px] font-mono uppercase placeholder:font-sans bg-white border border-slate-300 rounded-xl text-navy-900 placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim() || !password}
                className="w-full mt-2 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-[15px] shadow-brand transition"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Logging in...</span>
                  </>
                ) : (
                  <span>Sign in &rarr;</span>
                )}
              </button>

              <div className="pt-3 text-center border-t border-gray-100 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("register");
                  }}
                  className="text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  New customer? Register
                </button>
                <a href="#/login" className="text-gray-500 hover:text-gray-800">
                  Owner / staff login &rarr;
                </a>
              </div>
            </form>
          )}

          {/* OTP REQUEST FORM */}
          {step === "login" && authMode === "otp" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Registered email address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 h-12 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">A 6-digit code will be sent to your registered email only. No SMS OTP is sent.</p>
              </div>

              <div className="hidden">
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Shop code <span className="text-gray-400 font-normal lowercase">(optional if registered)</span>
                </label>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SHOP01 or leave blank"
                  className="w-full h-12 px-3.5 text-[15px] font-mono uppercase placeholder:font-sans bg-white border border-slate-300 rounded-xl text-navy-900 placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.includes("@")}
                className="w-full mt-2 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-[15px] shadow-brand transition"
              >
                {loading ? "Sending 6-digit OTP..." : "Continue with email OTP →"}
              </button>
            </form>
          )}

          {/* VERIFY OTP FORM */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center pb-1">
                <span className="text-xs text-gray-500">6-digit verification code sent to registered email</span>
                <div className="font-bold text-gray-800 text-sm mt-0.5">
                  {maskedEmail ? maskedEmail : identifier}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5 text-center">
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  className="w-full text-center tracking-[0.8em] text-2xl font-bold h-14 bg-white border border-slate-300 rounded-xl text-navy-900 placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-[15px] shadow-brand transition flex items-center justify-center gap-2"
              >
                {loading ? "Verifying..." : "Verify & Enter Portal &rarr;"}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("login");
                  }}
                  className="text-gray-500 hover:text-gray-800 font-medium"
                >
                  &larr; Back to Login
                </button>

                {resendCooldown > 0 ? (
                  <span className="text-gray-400">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRequestOtp()}
                    className="text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD: STEP 1 */}
          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="pb-1">
                <h3 className="text-sm font-bold text-gray-800">Forgot Your Password?</h3>
                <p className="text-xs text-gray-500">
                  Enter your registered email address. We will send a 6-digit code to reset your password.
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Registered email address
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  className="w-full px-3.5 h-12 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-[15px] shadow-brand transition"
              >
                {loading ? "Sending Code..." : "Send Verification Code &rarr;"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("login");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-800 font-medium"
                >
                  &larr; Back to Login
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD: STEP 2 */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="pb-1 text-center">
                <h3 className="text-sm font-bold text-gray-800">Set New Password</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verification code sent to {maskedEmail || identifier}
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5 text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  className="w-full text-center tracking-[0.8em] text-2xl font-bold h-14 bg-white border border-slate-300 rounded-xl text-navy-900 placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  New Password <span className="text-rose-500">* (Min 6 Characters)</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  className="w-full px-3.5 h-12 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || newPassword.length < 6}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-[15px] shadow-brand transition"
              >
                {loading ? "Resetting..." : "Reset Password & Log In &rarr;"}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("forgot");
                  }}
                  className="text-gray-500 hover:text-gray-800 font-medium"
                >
                  &larr; Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("login");
                  }}
                  className="text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="pb-1">
                <h3 className="text-sm font-bold text-gray-800">Register as a New Customer</h3>
                <p className="text-[11px] text-gray-500">Register with your name, mobile number and email. No shop code is required.</p>
              </div>

              <div className="hidden">
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Shop code
                </label>
                <input
                  type="text"
                  required
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SHOP01"
                  className="w-full h-11 px-3.5 text-[14px] font-mono uppercase placeholder:font-sans bg-white border border-slate-300 rounded-xl text-navy-900 placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Full Name / Business Name
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Sharma Ji Communication"
                  className="w-full px-3.5 h-11 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-semibold text-sm">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="w-full h-11 pl-11 pr-3 text-[14px] bg-white border border-slate-300 rounded-xl text-navy-900 placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 h-11 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="e.g. Shop No. 12, Main Market"
                  className="w-full px-3.5 h-11 bg-white border border-slate-300 rounded-xl text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !regName || regPhone.length < 10 || !regEmail}
                className="w-full mt-2 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-[15px] shadow-brand transition"
              >
                {loading ? "Submitting Registration..." : "Submit Registration"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("login");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  &larr; Already have an account? Sign In
                </button>
              </div>
            </form>
          )}
        </div>
    </AuthShell>
  );
}
