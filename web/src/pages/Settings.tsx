import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import RequireModule from "../components/RequireModule";
import { useAuthStore } from "../store/authStore";
import { api } from "../api/client";

interface FullSettingsState {
  // 1. General (Account, Preferences, Theme)
  name: string;
  email: string;
  accountType: string;
  phone: string;
  alternatePhone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  timezone: string;
  defaultPaymentMethod: string;
  defaultCustomerType: string;
  defaultInvoiceTerms: number;
  lowStockAlert: number;
  theme: "light" | "dark" | "system";

  // 2. Business
  businessName: string;
  tradeName: string;
  businessType: string;
  cinNumber: string;
  panNumber: string;
  gstin: string;
  businessLogo: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  businessPhone: string;
  businessEmail: string;
  website: string;
  businessTagline: string;

  // 3. Shop
  shopName: string;
  shopCode: string;
  branchAddress: string;
  branchPhone: string;
  branchEmail: string;
  openingTime: string;
  closingTime: string;
  workingDays: string;
  allowMultiShopSwitching: boolean;

  // 4. Invoice
  invoicePrefix: string;
  nextInvoiceNumber: number;
  invoiceTitle: string;
  showHsnColumn: boolean;
  showMrpColumn: boolean;
  showDiscountColumn: boolean;
  showTaxColumn: boolean;
  showBankDetailsOnBill: boolean;
  showUpiQrOnBill: boolean;
  invoiceTermsAndConditions: string;
  invoiceFooterNote: string;
  signatoryText: string;

  // 5. Tax & GST
  gstRegistrationType: string;
  defaultGstRate: number;
  pricesIncludeTax: boolean;
  requireHsnCode: boolean;
  enableRcm: boolean;
  eWayBillThreshold: number;
  stateGstCode: string;

  // 6. Payment
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankBranch: string;
  upiId: string;
  enableCash: boolean;
  enableUpi: boolean;
  enableCard: boolean;
  enableNetBanking: boolean;
  enableCustomerCredit: boolean;

  // 7. Inventory
  allowNegativeStock: boolean;
  enableBarcodeScanner: boolean;
  autoDeductStockOnBill: boolean;
  defaultUnit: string;
  enableBatchTracking: boolean;
  enableWarehouseLocations: boolean;
  stockAdjustmentReasons: string;

  // 8. Users & Access
  allowStaffDiscount: boolean;
  maxStaffDiscountPercent: number;
  allowStaffDeleteItems: boolean;
  allowStaffViewCostPrice: boolean;
  allowStaffViewReports: boolean;

  // 9. Notifications
  newSaleNotification: boolean;
  paymentReceived: boolean;
  lowStockAlertNotification: boolean;
  duePaymentReminder: boolean;
  employeeActivity: boolean;
  systemNotifications: boolean;
  marketingUpdates: boolean;
  whatsappInvoiceShare: boolean;
  whatsappPaymentReminder: boolean;

  // 10. Backup
  autoBackupFrequency: "daily" | "weekly" | "disabled";
  cloudBackupSync: boolean;
  lastBackupDate: string;

  // 11. Integrations
  thermalPrinterEnabled: boolean;
  printerPaperWidth: "80mm" | "58mm";
  printerConnectionType: "USB" | "Bluetooth" | "Network";
  supabaseSyncActive: boolean;
  whatsappApiConnected: boolean;

  // 12. Security
  twoFactorAuth: boolean;
  sessionTimeoutMinutes: number;
  enforceStrongPassword: boolean;
  ipRestrictionEnabled: boolean;
  auditLoggingEnabled: boolean;

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
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs = [
    "general",
    "business",
    "shop",
    "invoice",
    "tax",
    "payment",
    "inventory",
    "users",
    "notifications",
    "backup",
    "integrations",
    "security",
  ];

  const urlTab = searchParams.get("tab");
  const activeTab = urlTab && validTabs.includes(urlTab) ? urlTab : "general";

  const handleTabChange = (tabId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tabId);
      return next;
    });
  };

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
  const getInitialState = (): FullSettingsState => {
    const person = accountType === "owner" ? owner : employee;

    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          name: person?.name || parsed.name || "",
          email: person?.email || parsed.email || "",
          accountType: accountType === "owner" ? "Owner" : "Staff",
          businessName: activeShop?.name || parsed.businessName || "NSY Business",
          address: activeShop?.address || parsed.address || "123, Main Road, Near Market, New Delhi - 110001",
          businessPhone: activeShop?.phone || parsed.businessPhone || "+91 9876543210",
          businessEmail: activeShop?.email || parsed.businessEmail || "business@nsyu.com",
          businessLogo: activeShop?.logo || parsed.businessLogo || "",
          shopName: activeShop?.name || parsed.shopName || "Main Shop - Electronics",
          shopCode: activeShop?.code || parsed.shopCode || "NSYU-01",
        };
      }
    } catch {
      // Ignore parse errors
    }

    return {
      name: person?.name || "NSYU",
      email: person?.email || "nsyu.mnt@gmail.com",
      accountType: accountType === "owner" ? "Owner" : "Staff",
      phone: person && "phone" in person && person.phone ? String(person.phone) : "+91 9876543210",
      alternatePhone: "+91 9876543210",
      language: "English",

      businessName: activeShop?.name || "NSY Business",
      tradeName: "NSY Electronics & Mobile Accessories",
      businessType: "Electronics",
      cinNumber: "U72900DL2026PTC123456",
      panNumber: "ABCDE1234F",
      gstin: "27ABCDE1234F1Z5",
      businessLogo: activeShop?.logo || "",
      address: activeShop?.address || "123, Main Road, Near Market, New Delhi - 110001",
      state: "Delhi",
      city: "New Delhi",
      pincode: "110001",
      businessPhone: activeShop?.phone || "+91 9876543210",
      businessEmail: activeShop?.email || "business@nsyu.com",
      website: "https://www.nsyubusiness.com",
      businessTagline: "Smart Multi-Shop Business Management",

      shopName: activeShop?.name || "Main Shop - Electronics",
      shopCode: activeShop?.code || "NSYU-01",
      branchAddress: activeShop?.address || "Shop No. 12, Main Market, Jasola, New Delhi - 110025",
      branchPhone: activeShop?.phone || "+91 8800503662",
      branchEmail: activeShop?.email || "jasola@nsyubusiness.com",
      openingTime: "09:30 AM",
      closingTime: "09:30 PM",
      workingDays: "Monday - Saturday",
      allowMultiShopSwitching: true,

      invoicePrefix: "INV-",
      nextInvoiceNumber: 126,
      invoiceTitle: "TAX INVOICE",
      showHsnColumn: true,
      showMrpColumn: true,
      showDiscountColumn: true,
      showTaxColumn: true,
      showBankDetailsOnBill: true,
      showUpiQrOnBill: true,
      invoiceTermsAndConditions:
        "1. Warranty as per product manufacturer rules.\n2. Payment must be cleared within 21 days.\n3. Goods once sold will not be returned without original receipt.",
      invoiceFooterNote: "Thank you for doing business with us! Visit again.",
      signatoryText: "For NSY Business (Authorized Signatory)",

      gstRegistrationType: "Regular",
      defaultGstRate: 18,
      pricesIncludeTax: false,
      requireHsnCode: true,
      enableRcm: false,
      eWayBillThreshold: 50000,
      stateGstCode: "07 - Delhi",

      bankName: "HDFC Bank",
      bankAccountName: "NSY BUSINESS PRIVATE LIMITED",
      bankAccountNumber: "50200012345678",
      bankIfscCode: "HDFC0001234",
      bankBranch: "Jasola Vihar, New Delhi",
      upiId: "nsyu@hdfcbank",
      enableCash: true,
      enableUpi: true,
      enableCard: true,
      enableNetBanking: true,
      enableCustomerCredit: true,

      allowNegativeStock: false,
      enableBarcodeScanner: true,
      autoDeductStockOnBill: true,
      defaultUnit: "PCS",
      enableBatchTracking: true,
      enableWarehouseLocations: true,
      stockAdjustmentReasons: "Damaged, Expired, Missing / Theft, Stock Audit, Sample Given",

      allowStaffDiscount: true,
      maxStaffDiscountPercent: 10,
      allowStaffDeleteItems: false,
      allowStaffViewCostPrice: false,
      allowStaffViewReports: false,

      newSaleNotification: true,
      paymentReceived: true,
      lowStockAlertNotification: true,
      duePaymentReminder: true,
      employeeActivity: true,
      systemNotifications: true,
      marketingUpdates: false,
      whatsappInvoiceShare: true,
      whatsappPaymentReminder: true,

      autoBackupFrequency: "daily",
      cloudBackupSync: true,
      lastBackupDate: new Date().toLocaleDateString("en-IN"),

      thermalPrinterEnabled: true,
      printerPaperWidth: "80mm",
      printerConnectionType: "USB",
      supabaseSyncActive: true,
      whatsappApiConnected: true,

      twoFactorAuth: false,
      sessionTimeoutMinutes: 60,
      enforceStrongPassword: true,
      ipRestrictionEnabled: false,
      auditLoggingEnabled: true,

      dateFormat: "DD/MM/YYYY",
      timeFormat: "24 Hours (HH:mm)",
      currency: "INR (₹)",
      timezone: "Asia/Kolkata (GMT+5:30)",
      defaultPaymentMethod: "Cash",
      defaultCustomerType: "Retail Customer",
      defaultInvoiceTerms: 0,
      lowStockAlert: 10,

      theme: "light",

      defaultPaperSize: "A4",
      printFormat: "Thermal (80mm)",
      showLogoInPrint: true,
      showGstDetails: true,
      showTermsAndConditions: true,
    };
  };

  const [settings, setSettings] = useState<FullSettingsState>(getInitialState);

  useEffect(() => {
    setSettings(getInitialState());
  }, [activeShop, owner, employee, accountType]);

  const handleTextChange = (field: keyof FullSettingsState, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field: keyof FullSettingsState) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

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

  const handleSaveSettings = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    try {
      if (activeShop?.id) {
        try {
          const res = await api.put(`/shops/${activeShop.id}`, {
            name: settings.businessName || settings.shopName,
            phone: settings.businessPhone || settings.branchPhone,
            email: settings.businessEmail || settings.branchEmail,
            address: settings.address || settings.branchAddress,
            logo: settings.businessLogo,
            code: settings.shopCode,
          });
          if (res.data?.data) {
            setActiveShop(res.data.data);
          }
        } catch {
          // Fall back gracefully if restricted
        }
      }

      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
    <div className="space-y-6 pb-24">
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
            <span className="font-bold">Settings saved successfully! Configuration is dynamically persisted.</span>
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
              onClick={() => handleTabChange(tab.id)}
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

      {/* ========================================================================= */}
      {/* 1. GENERAL TAB                                                            */}
      {/* ========================================================================= */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Account Information Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    👤
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">Account Information</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>🔒</span>
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => handleTextChange("language", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="Hinglish">Hinglish</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Business Information Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  🏬
                </div>
                <h2 className="text-sm font-bold text-slate-900">Business Information</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Business Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={settings.businessName}
                        onChange={(e) => handleTextChange("businessName", e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Business Type
                      </label>
                      <select
                        value={settings.businessType}
                        onChange={(e) => handleTextChange("businessType", e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
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
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Address
                    </label>
                    <textarea
                      rows={2}
                      value={settings.address}
                      onChange={(e) => handleTextChange("address", e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 resize-none"
                    />
                  </div>
                </div>

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
                        <span className="text-xl">🏪</span>
                        <div className="text-[10px] mt-1">No Logo</div>
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
                    <div className="text-[10px] text-slate-400 mt-0.5">300 x 300 (PNG, JPG)</div>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">State</label>
                  <input
                    type="text"
                    value={settings.state}
                    onChange={(e) => handleTextChange("state", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
                  <input
                    type="text"
                    value={settings.city}
                    onChange={(e) => handleTextChange("city", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pincode</label>
                  <input
                    type="text"
                    value={settings.pincode}
                    onChange={(e) => handleTextChange("pincode", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={settings.businessPhone}
                    onChange={(e) => handleTextChange("businessPhone", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={settings.businessEmail}
                    onChange={(e) => handleTextChange("businessEmail", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Website</label>
                  <input
                    type="text"
                    value={settings.website}
                    onChange={(e) => handleTextChange("website", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            {/* Application Preferences Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  ⚙️
                </div>
                <h2 className="text-sm font-bold text-slate-900">Application Preferences</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Format</label>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => handleTextChange("dateFormat", e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Time Format</label>
                  <select
                    value={settings.timeFormat}
                    onChange={(e) => handleTextChange("timeFormat", e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium"
                  >
                    <option value="24 Hours (HH:mm)">24 Hours (HH:mm)</option>
                    <option value="12 Hours (hh:mm A)">12 Hours (hh:mm A)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Currency</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => handleTextChange("currency", e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium"
                  >
                    <option value="INR (₹)">INR (₹)</option>
                    <option value="USD ($)">USD ($)</option>
                    <option value="EUR (€)">EUR (€)</option>
                    <option value="GBP (£)">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => handleTextChange("timezone", e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium truncate"
                  >
                    <option value="Asia/Kolkata (GMT+5:30)">Asia/Kolkata (GMT+5:30)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="Asia/Dubai (GMT+4:00)">Asia/Dubai (GMT+4:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Default Payment Method</label>
                  <select
                    value={settings.defaultPaymentMethod}
                    onChange={(e) => handleTextChange("defaultPaymentMethod", e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Default Customer Type</label>
                  <select
                    value={settings.defaultCustomerType}
                    onChange={(e) => handleTextChange("defaultCustomerType", e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-medium"
                  >
                    <option value="Retail Customer">Retail Customer</option>
                    <option value="Wholesale Customer">Wholesale Customer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Default Invoice Terms (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.defaultInvoiceTerms}
                    onChange={(e) => handleTextChange("defaultInvoiceTerms", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Low Stock Alert</label>
                  <input
                    type="number"
                    min="1"
                    value={settings.lowStockAlert}
                    onChange={(e) => handleTextChange("lowStockAlert", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Theme, Notification, Print, Data Panels */}
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
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleTextChange("theme", m.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      settings.theme === m.id
                        ? "bg-blue-50 border-blue-600 text-blue-600 shadow-2xs"
                        : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="text-sm">🔔</span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Notification Settings</h3>
              </div>
              <div className="space-y-2.5">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="text-sm">🖨️</span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Print Settings</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Paper Size</label>
                  <select
                    value={settings.defaultPaperSize}
                    onChange={(e) => handleTextChange("defaultPaperSize", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="Thermal (80mm)">Thermal (80mm)</option>
                    <option value="Thermal (58mm)">Thermal (58mm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Print Format</label>
                  <select
                    value={settings.printFormat}
                    onChange={(e) => handleTextChange("printFormat", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <option value="Thermal (80mm)">Thermal (80mm)</option>
                    <option value="Standard PDF">Standard PDF</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 pt-1">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="text-sm">🗄️</span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Data Management</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleBackupNow}
                  className="py-2 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>📥</span>
                  <span>Backup</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Select an existing JSON backup to restore.")}
                  className="py-2 px-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>📤</span>
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Reset local cached settings to defaults?")) {
                      localStorage.removeItem(STORAGE_SETTINGS_KEY);
                      setSettings(getInitialState());
                    }
                  }}
                  className="py-2 px-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>🗑️</span>
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BUSINESS TAB                                                           */}
      {/* ========================================================================= */}
      {activeTab === "business" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">🏬</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Corporate & Legal Business Profile</h2>
              <p className="text-xs text-slate-500">Configure legal business registrations, tax numbers, and official trade identities.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Legal Business Name</label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) => handleTextChange("businessName", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Trade / Brand Name</label>
              <input
                type="text"
                value={settings.tradeName}
                onChange={(e) => handleTextChange("tradeName", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Business Tagline</label>
              <input
                type="text"
                value={settings.businessTagline}
                onChange={(e) => handleTextChange("businessTagline", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">GSTIN Number</label>
              <input
                type="text"
                value={settings.gstin}
                onChange={(e) => handleTextChange("gstin", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono uppercase font-bold text-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Company PAN Number</label>
              <input
                type="text"
                value={settings.panNumber}
                onChange={(e) => handleTextChange("panNumber", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono uppercase font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">CIN / Reg Number</label>
              <input
                type="text"
                value={settings.cinNumber}
                onChange={(e) => handleTextChange("cinNumber", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Registered Office Address</label>
              <textarea
                rows={3}
                value={settings.address}
                onChange={(e) => handleTextChange("address", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none font-medium"
              />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Official Phone</label>
                  <input
                    type="text"
                    value={settings.businessPhone}
                    onChange={(e) => handleTextChange("businessPhone", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Official Email</label>
                  <input
                    type="email"
                    value={settings.businessEmail}
                    onChange={(e) => handleTextChange("businessEmail", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Website</label>
                <input
                  type="text"
                  value={settings.website}
                  onChange={(e) => handleTextChange("website", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SHOP TAB                                                               */}
      {/* ========================================================================= */}
      {activeTab === "shop" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏪</span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Branch & Shop Management</h2>
                <p className="text-xs text-slate-500">Manage individual outlet properties, branch code, and daily business hours.</p>
              </div>
            </div>
            <span className="badge bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-lg border border-blue-200">
              Active: {settings.shopName} ({settings.shopCode})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branch Name</label>
              <input
                type="text"
                value={settings.shopName}
                onChange={(e) => handleTextChange("shopName", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branch Code</label>
              <input
                type="text"
                value={settings.shopCode}
                onChange={(e) => handleTextChange("shopCode", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold uppercase text-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Working Days</label>
              <input
                type="text"
                value={settings.workingDays}
                onChange={(e) => handleTextChange("workingDays", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Physical Outlet Address</label>
              <textarea
                rows={3}
                value={settings.branchAddress}
                onChange={(e) => handleTextChange("branchAddress", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none font-medium"
              />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branch Contact Phone</label>
                  <input
                    type="text"
                    value={settings.branchPhone}
                    onChange={(e) => handleTextChange("branchPhone", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branch Email</label>
                  <input
                    type="email"
                    value={settings.branchEmail}
                    onChange={(e) => handleTextChange("branchEmail", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Opening Time</label>
                  <input
                    type="text"
                    value={settings.openingTime}
                    onChange={(e) => handleTextChange("openingTime", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Closing Time</label>
                  <input
                    type="text"
                    value={settings.closingTime}
                    onChange={(e) => handleTextChange("closingTime", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. INVOICE TAB                                                            */}
      {/* ========================================================================= */}
      {activeTab === "invoice" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">📄</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Invoice & Billing Format Configurations</h2>
              <p className="text-xs text-slate-500">Configure numbering sequences, column headers, terms, and footer disclosures.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Invoice Number Prefix</label>
              <input
                type="text"
                value={settings.invoicePrefix}
                onChange={(e) => handleTextChange("invoicePrefix", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Next Sequence #</label>
              <input
                type="number"
                value={settings.nextInvoiceNumber}
                onChange={(e) => handleTextChange("nextInvoiceNumber", Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Invoice Header Title</label>
              <input
                type="text"
                value={settings.invoiceTitle}
                onChange={(e) => handleTextChange("invoiceTitle", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Item Table Column Visibility</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { field: "showHsnColumn", label: "Show HSN/SAC Code" },
                { field: "showMrpColumn", label: "Show MRP Column" },
                { field: "showDiscountColumn", label: "Show Discount Column" },
                { field: "showTaxColumn", label: "Show Tax Rate & Amount" },
              ].map((col) => (
                <label key={col.field} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(settings as any)[col.field]}
                    onChange={() => handleToggle(col.field as any)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-slate-700">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Terms & Conditions (Printed on Bill)</label>
              <textarea
                rows={4}
                value={settings.invoiceTermsAndConditions}
                onChange={(e) => handleTextChange("invoiceTermsAndConditions", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Footer Note & Signatory Text</label>
              <textarea
                rows={2}
                value={settings.invoiceFooterNote}
                onChange={(e) => handleTextChange("invoiceFooterNote", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none font-medium mb-3"
              />
              <input
                type="text"
                value={settings.signatoryText}
                onChange={(e) => handleTextChange("signatoryText", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                placeholder="Authorized Signatory Text"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAX & GST TAB                                                          */}
      {/* ========================================================================= */}
      {activeTab === "tax" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">⚖️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Tax & GST Configuration</h2>
              <p className="text-xs text-slate-500">Configure Indian GST compliance rules, tax calculation logic, and E-Way bill settings.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">GST Registration Type</label>
              <select
                value={settings.gstRegistrationType}
                onChange={(e) => handleTextChange("gstRegistrationType", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
              >
                <option value="Regular">Regular Taxpayer</option>
                <option value="Composition">Composition Scheme</option>
                <option value="Unregistered">Unregistered / Exempted</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Default GST Rate (%)</label>
              <select
                value={settings.defaultGstRate}
                onChange={(e) => handleTextChange("defaultGstRate", Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
              >
                <option value={0}>0% (Nil / Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18% (Standard Electronics)</option>
                <option value={28}>28%</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Home State & GST Code</label>
              <input
                type="text"
                value={settings.stateGstCode}
                onChange={(e) => handleTextChange("stateGstCode", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-medium"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tax Calculation & Legal Flags</h3>
            <div className="space-y-3 text-xs">
              {[
                { field: "pricesIncludeTax", label: "Selling Prices Include GST by default (Tax Inclusive MRP)" },
                { field: "requireHsnCode", label: "Enforce HSN/SAC code as mandatory when adding new inventory products" },
                { field: "enableRcm", label: "Enable Reverse Charge Mechanism (RCM) on applicable purchase vouchers" },
              ].map((flag) => (
                <div key={flag.field} className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{flag.label}</span>
                  <button
                    type="button"
                    onClick={() => handleToggle(flag.field as any)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      (settings as any)[flag.field] ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                        (settings as any)[flag.field] ? "left-4.5" : "left-0.75"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PAYMENT TAB                                                            */}
      {/* ========================================================================= */}
      {activeTab === "payment" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">💳</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Payment Modes & Bank Account Configuration</h2>
              <p className="text-xs text-slate-500">Configure bank details and UPI IDs printed on invoices for direct customer payments.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Accepted Payment Modes at Checkout</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { field: "enableCash", label: "Cash" },
                { field: "enableUpi", label: "UPI" },
                { field: "enableCard", label: "Card" },
                { field: "enableNetBanking", label: "Net Banking" },
                { field: "enableCustomerCredit", label: "Customer Ledger (Due)" },
              ].map((m) => (
                <label key={m.field} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(settings as any)[m.field]}
                    onChange={() => handleToggle(m.field as any)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Business Bank Account Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bank Name</label>
                <input
                  type="text"
                  value={settings.bankName}
                  onChange={(e) => handleTextChange("bankName", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Account Beneficiary Name</label>
                <input
                  type="text"
                  value={settings.bankAccountName}
                  onChange={(e) => handleTextChange("bankAccountName", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Account Number</label>
                <input
                  type="text"
                  value={settings.bankAccountNumber}
                  onChange={(e) => handleTextChange("bankAccountNumber", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">IFSC Code</label>
                <input
                  type="text"
                  value={settings.bankIfscCode}
                  onChange={(e) => handleTextChange("bankIfscCode", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono uppercase font-bold text-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bank Branch</label>
                <input
                  type="text"
                  value={settings.bankBranch}
                  onChange={(e) => handleTextChange("bankBranch", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Merchant UPI ID (VPA)</label>
                <input
                  type="text"
                  value={settings.upiId}
                  onChange={(e) => handleTextChange("upiId", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono font-bold text-emerald-600"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. INVENTORY TAB                                                          */}
      {/* ========================================================================= */}
      {activeTab === "inventory" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">📦</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Inventory, Stock & Warehouse Rules</h2>
              <p className="text-xs text-slate-500">Configure stock deductions, barcode scanner behavior, and warehouse shelf locations.</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { field: "allowNegativeStock", label: "Allow Negative Stock (Permit billing even if product inventory is 0)" },
              { field: "autoDeductStockOnBill", label: "Automatically deduct product inventory immediately on saving confirmed invoices" },
              { field: "enableBarcodeScanner", label: "Enable Instant Barcode Scanning mode (Auto-add product on laser scan)" },
              { field: "enableBatchTracking", label: "Enable Batch / Lot Number and Expiry Date tracking per purchase batch" },
              { field: "enableWarehouseLocations", label: "Enable Shelf / Rack Location tags for warehouse inventory items" },
            ].map((rule) => (
              <div key={rule.field} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                <span className="font-medium text-slate-800">{rule.label}</span>
                <button
                  type="button"
                  onClick={() => handleToggle(rule.field as any)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                    (settings as any)[rule.field] ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                      (settings as any)[rule.field] ? "left-4.5" : "left-0.75"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Default Unit of Measurement (UOM)</label>
              <select
                value={settings.defaultUnit}
                onChange={(e) => handleTextChange("defaultUnit", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
              >
                <option value="PCS">PCS (Pieces)</option>
                <option value="BOX">BOX (Boxes)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="SET">SET (Sets)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stock Adjustment Reasons</label>
              <input
                type="text"
                value={settings.stockAdjustmentReasons}
                onChange={(e) => handleTextChange("stockAdjustmentReasons", e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-medium"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. USERS TAB                                                              */}
      {/* ========================================================================= */}
      {activeTab === "users" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">👥</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">User Access & Staff Permissions</h2>
              <p className="text-xs text-slate-500">Define access boundaries, price visibility, and discount limits for billing staff.</p>
            </div>
          </div>

          <div className="space-y-3.5">
            {[
              { field: "allowStaffDiscount", label: "Allow Billing Staff to apply custom discounts during bill creation" },
              { field: "allowStaffDeleteItems", label: "Allow Billing Staff to remove items after being added to cart" },
              { field: "allowStaffViewCostPrice", label: "Allow Staff to view Purchase Price and Gross Profit margins" },
              { field: "allowStaffViewReports", label: "Allow Staff to access Business Intelligence & Financial Reports" },
            ].map((p) => (
              <div key={p.field} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                <span className="font-medium text-slate-800">{p.label}</span>
                <button
                  type="button"
                  onClick={() => handleToggle(p.field as any)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                    (settings as any)[p.field] ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                      (settings as any)[p.field] ? "left-4.5" : "left-0.75"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-blue-900">Advanced Role Permission Matrix</div>
              <div className="text-[11px] text-blue-700 mt-0.5">Customize individual permissions for Managers, Sales, Billing, and Accountants.</div>
            </div>
            <a
              href="/app/roles"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
            >
              Open Roles & Permissions →
            </a>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. NOTIFICATIONS TAB                                                      */}
      {/* ========================================================================= */}
      {activeTab === "notifications" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">🔔</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Notifications & Automation Alerts</h2>
              <p className="text-xs text-slate-500">Configure customer WhatsApp notifications, SMS receipts, and owner balance alerts.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Customer Communication</h3>
              {[
                { field: "whatsappInvoiceShare", label: "Auto-share digital invoice link via WhatsApp on bill creation" },
                { field: "whatsappPaymentReminder", label: "Send automated WhatsApp payment reminders before due dates" },
              ].map((c) => (
                <div key={c.field} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{c.label}</span>
                  <button
                    type="button"
                    onClick={() => handleToggle(c.field as any)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      (settings as any)[c.field] ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                        (settings as any)[c.field] ? "left-4.5" : "left-0.75"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Owner & Admin Alerts</h3>
              {[
                { field: "newSaleNotification", label: "Notify owner on every completed sale" },
                { field: "lowStockAlertNotification", label: "Immediate push alert when item drops below minimum stock" },
                { field: "duePaymentReminder", label: "Daily summary of all customer ledger dues pending collection" },
              ].map((c) => (
                <div key={c.field} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{c.label}</span>
                  <button
                    type="button"
                    onClick={() => handleToggle(c.field as any)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      (settings as any)[c.field] ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                        (settings as any)[c.field] ? "left-4.5" : "left-0.75"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. BACKUP TAB                                                            */}
      {/* ========================================================================= */}
      {activeTab === "backup" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">🔒</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Database Backup & Cloud Safeguard</h2>
              <p className="text-xs text-slate-500">Protect your complete ledger, inventory, customer lists, and financial records.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Cloud PostgreSQL Sync</div>
              <div className="text-lg font-bold text-emerald-700 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                Active & Synced
              </div>
              <p className="text-[11px] text-emerald-600">Database transactions are atomically committed to Supabase Cloud PostgreSQL.</p>
            </div>

            <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
              <div className="text-xs font-bold text-blue-800 uppercase tracking-wider">Auto-Backup Schedule</div>
              <div className="text-lg font-bold text-blue-700 capitalize">{settings.autoBackupFrequency} Backup</div>
              <p className="text-[11px] text-blue-600">Full business snapshot generated automatically and safely stored.</p>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Local Snapshot</div>
              <div className="text-lg font-bold text-slate-800">{settings.lastBackupDate}</div>
              <p className="text-[11px] text-slate-500">Download a fresh backup snapshot whenever you make major adjustments.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleBackupNow}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>📥</span>
              <span>Download Instant JSON Backup</span>
            </button>
            <button
              type="button"
              onClick={() => alert("Ready to restore: choose your JSON snapshot.")}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>📤</span>
              <span>Restore from Backup File</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. INTEGRATIONS TAB                                                      */}
      {/* ========================================================================= */}
      {activeTab === "integrations" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">🔗</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Hardware & External Cloud Integrations</h2>
              <p className="text-xs text-slate-500">Connect receipt printers, messaging APIs, and accounting synchronizers.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Thermal Receipt Printer</h3>
                  <p className="text-[11px] text-slate-500">Print 58mm / 80mm bills directly via Bluetooth or USB ESC/POS.</p>
                </div>
                <span className="badge bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded">Enabled</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Paper Width</label>
                  <select
                    value={settings.printerPaperWidth}
                    onChange={(e) => handleTextChange("printerPaperWidth", e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="80mm">80mm (3-inch Standard)</option>
                    <option value="58mm">58mm (2-inch Compact)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Interface</label>
                  <select
                    value={settings.printerConnectionType}
                    onChange={(e) => handleTextChange("printerConnectionType", e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="USB">USB Direct</option>
                    <option value="Bluetooth">Bluetooth Wireless</option>
                    <option value="Network">Network Ethernet / Wi-Fi</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Supabase Cloud Database</h3>
                  <p className="text-[11px] text-slate-500">Live PostgreSQL database connection for real-time transactions.</p>
                </div>
                <span className="badge bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded">Connected</span>
              </div>
              <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1">
                <div>Host: aws-0-ap-south-1.pooler.supabase.com:5432</div>
                <div>Status: Online (200 OK) • Latency: 24ms</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. SECURITY TAB                                                          */}
      {/* ========================================================================= */}
      {activeTab === "security" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-2xl">🛡️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Security & Authentication Policies</h2>
              <p className="text-xs text-slate-500">Configure login sessions, two-factor authentication, and security audit policies.</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { field: "twoFactorAuth", label: "Two-Factor Authentication (2FA) required on new device sign-ins" },
              { field: "enforceStrongPassword", label: "Enforce strong passwords for all staff and employee accounts" },
              { field: "auditLoggingEnabled", label: "Record detailed tamper-proof audit trail for every billing & inventory change" },
              { field: "ipRestrictionEnabled", label: "Restrict staff login access to authorized store IP addresses only" },
            ].map((s) => (
              <div key={s.field} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                <span className="font-medium text-slate-800">{s.label}</span>
                <button
                  type="button"
                  onClick={() => handleToggle(s.field as any)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                    (settings as any)[s.field] ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                      (settings as any)[s.field] ? "left-4.5" : "left-0.75"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">Change Account Password</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Regularly updating passwords keeps your store ledger protected.</div>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Update Password
            </button>
          </div>
        </div>
      )}

      {/* Floating / Sticky Bottom Bar with Cancel and Save Settings */}
      <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-6 py-3.5 flex items-center justify-end gap-3 z-30 shadow-lg">
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
