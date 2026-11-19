import { useEffect, useState } from "react";
import { getShopPortalSettings, updateShopPortalSettings } from "../api/shops";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { Icon } from "./ui";

export default function ShopPortalSettingsCard() {
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const isOwner = useAuthStore((s) => s.accountType === "owner");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showStockQty, setShowStockQty] = useState(false);
  const [allowOrders, setAllowOrders] = useState(true);
  const [allowSelfReg, setAllowSelfReg] = useState(true);
  const [allowCancel, setAllowCancel] = useState(true);
  const [minOrderValue, setMinOrderValue] = useState(0);

  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [announcementBanner, setAnnouncementBanner] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    getShopPortalSettings(shopId)
      .then((res) => {
        const d = res.data?.data as any;
        if (d) {
          setShowStockQty(Boolean(d.show_stock_qty ?? d.showStockQty));
          setAllowOrders(d.allow_orders !== undefined ? Boolean(d.allow_orders) : d.allowOrders !== undefined ? Boolean(d.allowOrders) : true);
          setAllowSelfReg(d.allow_self_registration !== undefined ? Boolean(d.allow_self_registration) : d.allowSelfRegistration !== undefined ? Boolean(d.allowSelfRegistration) : true);
          setAllowCancel(d.allow_customer_cancel !== undefined ? Boolean(d.allow_customer_cancel) : d.allowCustomerCancel !== undefined ? Boolean(d.allowCustomerCancel) : true);
          setMinOrderValue(Number(d.min_order_value ?? d.minOrderValue ?? 0));
          setPrivacyPolicy(d.privacy_policy || d.privacyPolicy || "");
          setTermsConditions(d.terms_conditions || d.termsConditions || "");
          setReturnPolicy(d.return_policy || d.returnPolicy || "");
          setAnnouncementBanner(d.announcement_banner || d.announcementBanner || "");
          setAnnouncementActive(Boolean(d.announcement_active ?? d.announcementActive));
        }
      })
      .catch((err) => {
        setError(apiErrorMessage(err, "Failed to load store portal settings"));
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || !isOwner) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateShopPortalSettings(shopId, {
        show_stock_qty: showStockQty,
        allow_orders: allowOrders,
        allow_self_registration: allowSelfReg,
        allow_customer_cancel: allowCancel,
        min_order_value: minOrderValue,
        privacy_policy: privacyPolicy.trim() || null,
        terms_conditions: termsConditions.trim() || null,
        return_policy: returnPolicy.trim() || null,
        announcement_banner: announcementBanner.trim() || null,
        announcement_active: announcementActive,
      });
      setSuccess("Store portal settings, announcements, and legal policies saved successfully.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/10 flex items-center justify-center font-bold text-lg">
            🛒
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">Customer Store & Legal Policies</h2>
            <p className="text-xs text-slate-500">
              Manage inventory visibility, customer ordering rules, and footer policies (Privacy, Terms & Returns){activeShop?.name ? ` for ${activeShop.name}` : ""}.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
          Loading store settings…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
              <Icon name="checkCircle" className="w-4 h-4 text-emerald-600 shrink-0" />
              {success}
            </div>
          )}

          {/* Section 1: Store Catalog & Ordering Toggles */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Catalog & Cart Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={showStockQty}
                  onChange={(e) => setShowStockQty(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Show Exact Stock Quantity to Customers</div>
                  <div className="text-slate-500 mt-0.5 leading-relaxed">
                    When turned off (recommended), customers see “In stock” or “Low stock” without disclosing your exact inventory numbers.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={allowOrders}
                  onChange={(e) => setAllowOrders(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Allow Online Orders</div>
                  <div className="text-slate-500 mt-0.5 leading-relaxed">
                    Allow registered customers to place orders online through your customer portal.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={allowSelfReg}
                  onChange={(e) => setAllowSelfReg(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Allow Customer Self-Registration</div>
                  <div className="text-slate-500 mt-0.5 leading-relaxed">
                    New shoppers can register an account directly on your store using their phone or email.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={allowCancel}
                  onChange={(e) => setAllowCancel(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Allow Customer Order Cancellation</div>
                  <div className="text-slate-500 mt-0.5 leading-relaxed">
                    Customers can cancel their pending orders before your staff starts processing them.
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-4 max-w-xs">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800"
                placeholder="0"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Set 0 for no minimum cart requirement.</span>
            </div>
          </div>

          {/* Section: Promotional & Store Announcement Bar */}
          <div className="border-t border-slate-100 pt-5">
            <div className="mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Store Announcement & Offers Bar</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays a prominent promotional notification bar across the top of your online store and customer portal.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={announcementActive}
                  onChange={(e) => setAnnouncementActive(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Enable Announcement Bar on Store</div>
                  <div className="text-slate-500 mt-0.5 leading-relaxed">
                    Turn on to broadcast festival greetings, discount offers, delivery updates, or branch announcements to visiting customers.
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Announcement / Offer Text
                </label>
                <input
                  type="text"
                  value={announcementBanner}
                  onChange={(e) => setAnnouncementBanner(e.target.value)}
                  placeholder="e.g. 📢 Special Offer: Flat 5% off on bulk orders above ₹10,000! Call for trade discount."
                  maxLength={250}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Visible to all customers at the top of your shop portal.</span>
              </div>
            </div>
          </div>

          {/* Section 2: Store Policies (Footer Information Column) */}
          <div className="border-t border-slate-100 pt-5">
            <div className="mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Store Policies & Legal Terms</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                These texts appear in your customer portal footer under the “Information” column. Customers can tap them to view your policies anytime.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Privacy Policy</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <textarea
                  rows={4}
                  value={privacyPolicy}
                  onChange={(e) => setPrivacyPolicy(e.target.value)}
                  placeholder="Explain how you handle customer phone numbers, addresses, and purchase history (e.g. 'We collect your phone number and address solely to process and deliver your orders...')"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-1 focus:ring-emerald-500 resize-y text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Terms & Conditions</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <textarea
                  rows={4}
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  placeholder="Specify ordering terms, price validity, payment terms, or delivery expectations (e.g. 'Orders are subject to item availability at the branch...')"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-1 focus:ring-emerald-500 resize-y text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Return & Refund Policy</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <textarea
                  rows={4}
                  value={returnPolicy}
                  onChange={(e) => setReturnPolicy(e.target.value)}
                  placeholder="Specify rules for exchanges, damaged products, or return windows (e.g. 'Damaged or wrong items can be returned within 3 days with bill receipt...')"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-1 focus:ring-emerald-500 resize-y text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Icon name="check" className="w-4 h-4" />
                  Save Store & Policy Settings
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
