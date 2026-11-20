import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { useAuthStore } from "../store/authStore";

interface DemoBarProps {
  onOpenGuide?: () => void;
}

export default function DemoBar({ onOpenGuide }: DemoBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const customer = usePortalStore((s) => s.customer);
  const setCustomerSession = usePortalStore((s) => s.setCustomerSession);
  const logoutPortal = usePortalStore((s) => s.logoutCustomer);
  const setMe = useAuthStore((s) => s.setMe);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const setSession = useAuthStore((s) => s.setSession);
  const logoutAuth = useAuthStore((s) => s.logout);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const currentRole = (() => {
    if (location.pathname === "/mobile") return "mobile";
    if (location.pathname.startsWith("/admin")) return "admin";
    if (location.pathname.startsWith("/app")) return "owner";
    if (location.pathname.startsWith("/portal") || customer) return "customer";
    return "public";
  })();

  const switchToPersona = (role: string) => {
    if (role === "public") {
      logoutPortal();
      logoutAuth();
      navigate("/");
      showToast("Switched to Public Storefront");
      return;
    }

    if (role === "customer") {
      setCustomerSession("demo-customer-token", "demo-customer-refresh", {
        id: 1,
        name: "Amit Kumar",
        phone: "98765 43210",
        email: "amit@example.com",
        address: "B-14, Mithepur Extension, Badarpur, New Delhi 110044",
        gstin: null,
        currentBalance: 3000,
        shop: {
          id: 1,
          name: "Sharma Mobile Hub",
          code: "SMH",
          phone: "011 4000 0001",
          email: "sharma@shop.demo",
        },
      });
      navigate("/portal/account");
      showToast("Signed in as Customer: Amit Kumar");
      return;
    }

    if (role === "owner") {
      setSession("demo-owner-token", "demo-owner-refresh", "owner");
      setMe({
        owner: {
          id: 1,
          name: "Rakesh Sharma",
          email: "rakesh@sharmahub.in",
          phone: "98100 11122",
          status: "active",
        },
        shopId: 1,
        roleId: 1,
        roleName: "Owner",
        assignedShopIds: [1, 2],
        permissions: {},
        fieldPermissions: {},
      });
      setActiveShop({
        id: 1,
        name: "Sharma Mobile Hub",
        code: "SMH",
        owner_id: 1,
        address: "Shop 4, Main Market, Badarpur, Delhi 110044",
        phone: "011 4000 0001",
        email: "sharma@shop.demo",
        status: "active",
      });
      navigate("/app");
      showToast("Signed in as Shop Owner: Rakesh Sharma");
      return;
    }

    if (role === "admin") {
      setSession("demo-admin-token", "demo-admin-refresh", "super_admin");
      setMe({
        employee: {
          id: 99,
          owner_id: 0,
          name: "Anita Desai",
          email: "admin@nsyu.demo",
          phone: "90000 00001",
          status: "active",
        },
        shopId: null,
        roleId: 99,
        roleName: "Super Admin",
        assignedShopIds: [],
        permissions: {},
        fieldPermissions: {},
      });
      setActiveShop(null);
      navigate("/admin");
      showToast("Signed in as Super Admin: Anita Desai");
      return;
    }

    if (role === "mobile") {
      navigate("/mobile");
      showToast("Switched to Mobile App interactive preview");
      return;
    }
  };

  const handleResetData = () => {
    localStorage.removeItem("nsyu_demo_custom");
    showToast("Demo data reset to original sample records");
  };

  return (
    <>
      <div className="bg-[#064E3B] text-[#D1FAE5] text-[11.5px] font-medium py-1.5 px-3 border-b border-[#047857]/50 select-none">
        <div className="max-w-[1340px] mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <b className="text-white font-extrabold tracking-wide uppercase text-[11px] mr-1">
              PROTOTYPE
            </b>
            <span className="hidden md:inline text-emerald-200/80 mr-2">
              Sample data, held in memory only.
            </span>

            {/* Persona Switch Buttons */}
            <button
              type="button"
              onClick={() => switchToPersona("public")}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                currentRole === "public"
                  ? "bg-white text-[#064E3B] font-bold shadow-xs"
                  : "bg-white/10 text-emerald-100 hover:bg-white/20 border border-white/20"
              }`}
            >
              Public site
            </button>

            <button
              type="button"
              onClick={() => switchToPersona("customer")}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                currentRole === "customer"
                  ? "bg-white text-[#064E3B] font-bold shadow-xs"
                  : "bg-white/10 text-emerald-100 hover:bg-white/20 border border-white/20"
              }`}
            >
              Customer
            </button>

            <button
              type="button"
              onClick={() => switchToPersona("owner")}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                currentRole === "owner"
                  ? "bg-white text-[#064E3B] font-bold shadow-xs"
                  : "bg-white/10 text-emerald-100 hover:bg-white/20 border border-white/20"
              }`}
            >
              Owner
            </button>

            <button
              type="button"
              onClick={() => switchToPersona("admin")}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                currentRole === "admin"
                  ? "bg-white text-[#064E3B] font-bold shadow-xs"
                  : "bg-white/10 text-emerald-100 hover:bg-white/20 border border-white/20"
              }`}
            >
              Super admin
            </button>

            <button
              type="button"
              onClick={() => switchToPersona("mobile")}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                currentRole === "mobile"
                  ? "bg-white text-[#064E3B] font-bold shadow-xs"
                  : "bg-white/10 text-emerald-100 hover:bg-white/20 border border-white/20"
              }`}
            >
              Mobile app
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {onOpenGuide && (
              <button
                type="button"
                onClick={onOpenGuide}
                className="px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-100 hover:bg-white/20 border border-white/20 font-semibold cursor-pointer"
              >
                Demo guide
              </button>
            )}
            <button
              type="button"
              onClick={handleResetData}
              className="px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-100 hover:bg-white/20 border border-white/20 font-semibold cursor-pointer"
            >
              Reset data
            </button>
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl animate-bounce">
          ✓ {toastMsg}
        </div>
      )}
    </>
  );
}
