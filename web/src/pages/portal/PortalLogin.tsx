import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { requestOtpApi, verifyOtpApi, portalApi } from "../../api/portal";
import { usePortalStore } from "../../store/portalStore";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setCustomerSession = usePortalStore((s) => s.setCustomerSession);

  // Read prefilled shop from query if present (?shop=SHOP01)
  const queryShop = searchParams.get("shop") || searchParams.get("shopCode") || "";

  const [step, setStep] = useState<"phone" | "otp" | "register">("phone");
  const [identifier, setIdentifier] = useState(
    searchParams.get("identifier") || searchParams.get("phone") || searchParams.get("email") || ""
  );
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [shopCode, setShopCode] = useState(queryShop);
  const [otp, setOtp] = useState("");
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

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setError("Please enter your mobile number or registered email address.");
      return;
    }

    const isEmail = cleanInput.includes("@");
    if (!isEmail && cleanInput.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number or email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtpApi(cleanInput, shopCode.trim() || undefined);
      setSuccessMsg(res.message || "4-digit OTP sent to your registered email.");
      if (res.maskedEmail) {
        setMaskedEmail(res.maskedEmail);
      }
      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to send OTP.";
      if (err.response?.status === 404 && msg.includes("Customer account not found")) {
        setError(msg + " You can register below if self-registration is enabled.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.trim().length !== 4) {
      setError("Please enter the 4-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtpApi(identifier.trim(), otp.trim(), shopCode.trim() || undefined);
      const { accessToken, refreshToken, customer } = res.data;
      setCustomerSession(accessToken, refreshToken, customer);
      navigate("/portal/home", { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || "Invalid or expired OTP. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regName.trim() || !regPhone.trim() || !regEmail.trim() || !shopCode.trim()) {
      setError("Name, Mobile, Email, and Shop Code are required for registration.");
      return;
    }

    setLoading(true);
    try {
      const res = await portalApi.post("/customer-portal/auth/register", {
        shopCode: shopCode.trim(),
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        address: regAddress.trim() || undefined,
      });
      setIdentifier(regEmail.trim() || regPhone.trim());
      setSuccessMsg(res.data?.message || "Registered successfully! Verification 4-digit OTP sent to your email.");
      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Registration failed. Please check your shop code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#022C22] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-emerald-900/10">
        {/* Header */}
        <div className="bg-[#047857] p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 mb-3 shadow-inner">
            <span className="text-2xl font-black tracking-wider text-white">N</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">NSYU Customer Portal</h1>
          <p className="text-emerald-100 text-xs mt-1">Shop orders, real-time catalog & statement portal</p>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Phone or Email & Shop Code */}
          {step === "phone" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mobile Number or Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 font-semibold text-sm">
                    {identifier.includes("@") ? "✉️" : "📱"}
                  </span>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter mobile number or email"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Enter your mobile or email. OTP will be sent to your registered email.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Shop Code <span className="text-gray-400 font-normal lowercase">(optional if registered)</span>
                </label>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SHOP01 or leave blank"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium uppercase tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">If you have accounts in multiple shops, enter the specific shop code.</p>
              </div>

              <button
                type="submit"
                disabled={loading || identifier.trim().length < 3}
                className="w-full mt-2 py-3 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Sending 4-Digit OTP...</span>
                  </>
                ) : (
                  <span>Continue with 4-Digit OTP &rarr;</span>
                )}
              </button>

              <div className="pt-3 text-center border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("register");
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2"
                >
                  New Customer? Register with Shop Code
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Verify OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center pb-1">
                <span className="text-xs text-gray-500">4-digit verification code sent to registered email</span>
                <div className="font-bold text-gray-800 text-sm mt-0.5">
                  {maskedEmail ? maskedEmail : identifier}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 text-center">
                  Enter 4-Digit OTP
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="&bull;&bull;&bull;&bull;"
                  className="w-full text-center tracking-[0.8em] text-2xl font-bold py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 4}
                className="w-full py-3 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify & Enter Portal &rarr;</span>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("phone");
                  }}
                  className="text-gray-500 hover:text-gray-800 font-medium"
                >
                  &larr; Change Email / Mobile
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

          {/* STEP 3: Self Registration */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="pb-1">
                <h3 className="text-sm font-bold text-gray-800">Register as a New Customer</h3>
                <p className="text-[11px] text-gray-500">Ask the shop owner for their Shop Code if you don't know it.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Shop Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SHOP01"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Sharma Ji Communication"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
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
                    className="w-full pl-11 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com (OTP is sent here)"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">Verification OTP will be sent strictly to this email.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="e.g. Shop No. 12, Main Market"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !regName || regPhone.length < 10 || !regEmail || !shopCode}
                className="w-full mt-2 py-2.5 bg-[#047857] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow transition"
              >
                {loading ? "Registering..." : "Register & Send 4-Digit OTP"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("phone");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  &larr; Already have an account? Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
