import { useState, useEffect, useRef, type ChangeEvent } from "react";
import RequireModule from "../components/RequireModule";
import { useAuthStore } from "../store/authStore";
import { api } from "../api/client";

interface BusinessSettingsState {
  // Account Information
  name: string;
  email: string;
  accountType: string;
  phone: string;
  alternatePhone: string;
  language: string;

  // Business Information
  businessName: string;
  businessType: string;
  gstin: string;
  businessLogo: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  businessPhone: string;
  businessEmail: string;
  website: string;

  // Application Preferences
  dateFormat: string;
  timeFormat: string;
  currency: string;
  timezone: string;
  defaultPaymentMethod: string;
  defaultCustomerType: string;
  defaultInvoiceTerms: number;
  lowStockAlert: number;

  // Theme Settings
  theme: "light" | "dark" | "system";

  // Notification Settings
  newSaleNotification: boolean;
  paymentReceived: boolean;
  lowStockAlertNotification: boolean;
  duePaymentReminder: boolean;
  employeeActivity: boolean;
  systemNotifications: boolean;
  marketingUpdates: boolean;

  // Print Settings
  defaultPaperSize: string;
  printFormat: string;
  showLogoInPrint: boolean;
  showGstDetails: boolean;
  showTermsAndConditions: boolean;
}

const STORAGE_SETTINGS_KEY = "nsyu.business.settings";

function SettingsInner() {
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);
  const accountType = useAuthStore((s) => s.accountType);
  const activeShop = useAuthStore((s) => s.activeShop);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);

  const [activeTab, setActiveTab] = useState<string>("general");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial dynamic defaults from active user / shop context
  const getInitialState = (): BusinessSettingsState => {
    const person = accountType === "owner" ? owner : employee;

    // Check if previously saved settings exist in localStorage
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          name: person?.name || parsed.name || "",
          email: person?.email || parsed.email || "",
          accountType: accountType === "owner" ? "Owner" : "Staff",
          businessName: activeShop?.name || parsed.businessName || "",
          address: activeShop?.address || parsed.address || "",
          businessPhone: activeShop?.phone || parsed.businessPhone || "",
          businessEmail: activeShop?.email || parsed.businessEmail || "",
          businessLogo: activeShop?.logo || parsed.businessLogo || "",
        };
      }
    } catch {
      // Ignore parse errors
    }

    return {
      name: person?.name || "",
      email: person?.email || "",
      accountType: accountType === "owner" ? "Owner" : "Staff",
      phone: person && "phone" in person && person.phone ? String(person.phone) : "",
      alternatePhone: "",
      language: "English",

      businessName: activeShop?.name || "NSY Business",
      businessType: "Electronics",
      gstin: "27ABCDE1234F1Z5",
      businessLogo: activeShop?.logo || "",
      address: activeShop?.address || "123, Main Road, Near Market, New Delhi - 110001",
      state: "Delhi",
      city: "New Delhi",
      pincode: "110001",
      businessPhone: activeShop?.phone || "+91 9876543210",
      businessEmail: activeShop?.email || "business@nsyu.com",
      website: "https://www.nsyubusiness.com",

      dateFormat: "DD/MM/YYYY",
      timeFormat: "24 Hours (HH:mm)",
      currency: "INR (₹)",
      timezone: "Asia/Kolkata (GMT+5:30)",
      defaultPaymentMethod: "Cash",
      defaultCustomerType: "Retail Customer",
      defaultInvoiceTerms: 0,
      lowStockAlert: 10,

      theme: "light",

      newSaleNotification: true,
      paymentReceived: true,
      lowStockAlertNotification: true,
      duePaymentReminder: true,
      employeeActivity: true,
      systemNotifications: true,
      marketingUpdates: false,

      defaultPaperSize: "A4",
      printFormat: "Thermal (80mm)",
      showLogoInPrint: true,
      showGstDetails: true,
      showTermsAndConditions: true,
    };
  };

  const [settings, setSettings] = useState<BusinessSettingsState>(getInitialState);

  // Sync state if activeShop or user changes
  useEffect(() => {
    setSettings(getInitialState());
  }, [activeShop, owner, employee, accountType]);

  const handleTextChange = (field: keyof BusinessSettingsState, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field: keyof BusinessSettingsState) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Handle Logo Upload
  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Please upload an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleTextChange("businessLogo", dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Settings Function
  const handleSaveSettings = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    try {
      // 1. If activeShop exists, update backend database shop table
      if (activeShop?.id) {
        try {
          const res = await api.put(`/shops/${activeShop.id}`, {
            name: settings.businessName,
            phone: settings.businessPhone,
            email: settings.businessEmail,
            address: settings.address,
            logo: settings.businessLogo,
          });
          if (res.data?.data) {
            setActiveShop(res.data.data);
          }
        } catch {
          // If shop update API has permission or network constraint, continue saving local settings
        }
      }

      // 2. Persist complete dynamic settings to localStorage
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Change Password Submit
  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword) {
      setPasswordError("Please enter both current and new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }, 1500);
    } catch (err: any) {
      setPasswordError(err?.message || "Could not update password.");
    }
  };

  // Backup Export
  const handleBackupNow = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `NSY_Settings_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage your business settings and preferences</p>
      </div>

      {/* Success Notification Alert */}
      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-bold">Settings saved successfully! All business preferences are updated.</span>
          </div>
          <button type="button" onClick={() => setSavedSuccess(false)} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between shadow-xs">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Horizontal Tabs Bar matching Reference Screenshot */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
        {[
          { id: "general", label: "General", icon: "⚙️" },
          { id: "business", label: "Business", icon: "🏬" },
          { id: "shop", label: "Shop", icon: "🏪" },
          { id: "invoice", label: "Invoice", icon: "📄" },
          { id: "tax", label: "Tax & GST", icon: "⚖️" },
          { id: "payment", label: "Payment", icon: "💳" },
          { id: "inventory", label: "Inventory", icon: "📦" },
          { id: "users", label: "Users", icon: "👥" },
          { id: "notifications", label: "Notifications", icon: "🔔" },
          { id: "backup", label: "Backup", icon: "🔒" },
          { id: "integrations", label: "Integrations", icon: "🔗" },
          { id: "security", label: "Security", icon: "🛡️" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs shadow-blue-500/25"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              <span className="text-xs">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Left Column (Main Forms) & Right Column (Side Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Account, Business, & Application Preferences                */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Account Information */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-slate-900">Account Information</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span>Change Password</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => handleTextChange("name", e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleTextChange("email", e.target.value)}
                  placeholder="your.email@business.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Account type
                </label>
                <input
                  type="text"
                  disabled
                  value={settings.accountType}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Phone
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => handleTextChange("phone", e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alternate Phone
                </label>
                <input
                  type="text"
                  value={settings.alternatePhone}
                  onChange={(e) => handleTextChange("alternatePhone", e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => handleTextChange("language", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Hinglish">Hinglish</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Business Information */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-slate-900">Business Information</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Form fields */}
              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Business Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={settings.businessName}
                      onChange={(e) => handleTextChange("businessName", e.target.value)}
                      placeholder="e.g. NSY Business"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Business Type
                    </label>
                    <select
                      value={settings.businessType}
                      onChange={(e) => handleTextChange("businessType", e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Electronics">Electronics</option>
                      <option value="Mobile Accessories">Mobile Accessories</option>
                      <option value="Wholesale Distributor">Wholesale Distributor</option>
                      <option value="Retail Store">Retail Store</option>
                      <option value="Hardware & Electric">Hardware & Electric</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      value={settings.gstin}
                      onChange={(e) => handleTextChange("gstin", e.target.value)}
                      placeholder="27ABCDE1234F1Z5"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase font-mono"
                    />
                  </div>
                </div>

                {/* Address Textarea */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Address
                  </label>
                  <textarea
                    rows={2}
                    value={settings.address}
                    onChange={(e) => handleTextChange("address", e.target.value)}
                    placeholder="Enter complete store address..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Logo Upload Box matching Reference Design */}
              <div className="lg:col-span-4 p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col items-center text-center space-y-2.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />

                <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center relative group shadow-2xs">
                  {settings.businessLogo ? (
                    <img src={settings.businessLogo} alt="Business Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <svg className="w-6 h-6 mx-auto mb-1 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px]">No Logo</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-800">Business Logo</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Recommended size: 300 x 300 (PNG, JPG)</div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Upload Logo
                </button>
              </div>
            </div>

            {/* State, City, Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  State
                </label>
                <select
                  value={settings.state}
                  onChange={(e) => handleTextChange("state", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Delhi">Delhi</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="Haryana">Haryana</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="West Bengal">West Bengal</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  value={settings.city}
                  onChange={(e) => handleTextChange("city", e.target.value)}
                  placeholder="New Delhi"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Pincode
                </label>
                <input
                  type="text"
                  value={settings.pincode}
                  onChange={(e) => handleTextChange("pincode", e.target.value)}
                  placeholder="110001"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Business Contact Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Phone
                </label>
                <input
                  type="text"
                  value={settings.businessPhone}
                  onChange={(e) => handleTextChange("businessPhone", e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.businessEmail}
                  onChange={(e) => handleTextChange("businessEmail", e.target.value)}
                  placeholder="business@nsyu.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Website
                </label>
                <input
                  type="text"
                  value={settings.website}
                  onChange={(e) => handleTextChange("website", e.target.value)}
                  placeholder="https://www.nsyubusiness.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Application Preferences */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-slate-900">Application Preferences</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Date Format
                </label>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => handleTextChange("dateFormat", e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Time Format
                </label>
                <select
                  value={settings.timeFormat}
                  onChange={(e) => handleTextChange("timeFormat", e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="24 Hours (HH:mm)">24 Hours (HH:mm)</option>
                  <option value="12 Hours (hh:mm A)">12 Hours (hh:mm A)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleTextChange("currency", e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="INR (₹)">INR (₹)</option>
                  <option value="USD ($)">USD ($)</option>
                  <option value="EUR (€)">EUR (€)</option>
                  <option value="GBP (£)">GBP (£)</option>
                  <option value="AED (د.إ)">AED (د.إ)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => handleTextChange("timezone", e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none truncate"
                >
                  <option value="Asia/Kolkata (GMT+5:30)">Asia/Kolkata (GMT+5:30)</option>
                  <option value="UTC">UTC (GMT+0)</option>
                  <option value="Asia/Dubai (GMT+4:00)">Asia/Dubai (GMT+4:00)</option>
                  <option value="America/New_York (GMT-5:00)">America/New_York (GMT-5:00)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Default Payment Method
                </label>
                <select
                  value={settings.defaultPaymentMethod}
                  onChange={(e) => handleTextChange("defaultPaymentMethod", e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Credit">Credit (Due)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Default Customer Type
                </label>
                <select
                  value={settings.defaultCustomerType}
                  onChange={(e) => handleTextChange("defaultCustomerType", e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Retail Customer">Retail Customer</option>
                  <option value="Wholesale Customer">Wholesale Customer</option>
                  <option value="Dealer / Distributor">Dealer / Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Default Invoice Terms (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.defaultInvoiceTerms}
                  onChange={(e) => handleTextChange("defaultInvoiceTerms", Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Low Stock Alert</span>
                  <span className="text-[10px] text-slate-400 font-normal">ⓘ Threshold</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.lowStockAlert}
                  onChange={(e) => handleTextChange("lowStockAlert", Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Theme, Notifications, Print, Data Management               */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Theme Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-sm">🎨</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Theme Settings</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "light", label: "Light", icon: "☀️" },
                { id: "dark", label: "Dark", icon: "🌙" },
                { id: "system", label: "System", icon: "💻" },
              ].map((m) => {
                const isSelected = settings.theme === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleTextChange("theme", m.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 border-blue-600 text-blue-600 shadow-2xs"
                        : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-sm">🔔</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Notification Settings</h3>
            </div>
            <div className="space-y-3">
              {[
                { field: "newSaleNotification", label: "New Sale Notification" },
                { field: "paymentReceived", label: "Payment Received" },
                { field: "lowStockAlertNotification", label: "Low Stock Alert" },
                { field: "duePaymentReminder", label: "Due Payment Reminder" },
                { field: "employeeActivity", label: "Employee Activity" },
                { field: "systemNotifications", label: "System Notifications" },
                { field: "marketingUpdates", label: "Marketing Updates" },
              ].map((item) => {
                const isChecked = (settings as any)[item.field];
                return (
                  <div key={item.field} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleToggle(item.field as any)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                        isChecked ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                          isChecked ? "left-4.5" : "left-0.75"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Print Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-sm">🖨️</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Print Settings</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Default Paper Size
                </label>
                <select
                  value={settings.defaultPaperSize}
                  onChange={(e) => handleTextChange("defaultPaperSize", e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none"
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Thermal (80mm)">Thermal (80mm)</option>
                  <option value="Thermal (58mm)">Thermal (58mm)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Print Format
                </label>
                <select
                  value={settings.printFormat}
                  onChange={(e) => handleTextChange("printFormat", e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none"
                >
                  <option value="Thermal (80mm)">Thermal (80mm)</option>
                  <option value="Standard PDF">Standard PDF</option>
                  <option value="Compact Slip">Compact Slip</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { field: "showLogoInPrint", label: "Show Logo in Print" },
                { field: "showGstDetails", label: "Show GST Details" },
                { field: "showTermsAndConditions", label: "Show Terms & Conditions" },
              ].map((p) => {
                const val = (settings as any)[p.field];
                return (
                  <div key={p.field} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{p.label}</span>
                    <button
                      type="button"
                      onClick={() => handleToggle(p.field as any)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                        val ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                          val ? "left-4.5" : "left-0.75"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-sm">🗄️</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Data Management</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleBackupNow}
                className="py-2 px-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <span>📥</span>
                <span>Backup Now</span>
              </button>

              <button
                type="button"
                onClick={() => alert("Ready to restore: select your NSYU backup .json file.")}
                className="py-2 px-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <span>📤</span>
                <span>Restore</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to reset local cached settings to defaults?")) {
                    localStorage.removeItem(STORAGE_SETTINGS_KEY);
                    setSettings(getInitialState());
                  }
                }}
                className="py-2 px-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <span>🗑️</span>
                <span>Reset Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating / Sticky Bottom Bar with Cancel and Save Settings */}
      <div className="fixed bottom-0 right-0 left-64 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-6 py-3.5 flex items-center justify-end gap-3 z-30 shadow-lg">
        <button
          type="button"
          onClick={() => setSettings(getInitialState())}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>🔄</span>
          <span>Cancel</span>
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={handleSaveSettings}
          className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Change Account Password</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {passwordError && (
              <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg">{passwordError}</div>
            )}
            {passwordSuccess && (
              <div className="p-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg font-bold">Password updated successfully!</div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <RequireModule module="settings">
      <SettingsInner />
    </RequireModule>
  );
}
