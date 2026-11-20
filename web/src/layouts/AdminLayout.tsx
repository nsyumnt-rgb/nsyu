import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import AdminFooter from "./AdminFooter";
import DemoBar from "../components/DemoBar";
import HinglishToggle from "../components/HinglishToggle";
import DemoGuideModal from "../components/DemoGuideModal";

export default function AdminLayout() {
  const { owner, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [demoGuideOpen, setDemoGuideOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    {
      to: "/admin",
      end: true,
      label: "Platform Dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      to: "/admin/shops",
      end: false,
      label: "Shop Management",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      to: "/admin/owners",
      end: false,
      label: "Owner Management",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      to: "/admin/audit-logs",
      end: false,
      label: "Platform Audit Log",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      to: "/admin/support",
      end: false,
      label: "Shop Support Viewer",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
  ];

  const current = navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  const sidebar = (
    <>
      <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between shrink-0">
        <Link to="/admin" className="flex items-center gap-3 min-w-0" onClick={() => setOpen(false)}>
          <span className="w-9 h-9 rounded-lg bg-white p-1 shrink-0"><img src="/nsyu_logo.png" alt="" className="w-full h-full object-contain" /></span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold tracking-tight text-white">NSYU Platform</span>
            <span className="block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-300/90">Super admin</span>
          </span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="lg:hidden w-9 h-9 rounded-lg text-slate-300 hover:bg-white/10 flex items-center justify-center" aria-label="Close menu">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">Platform governance</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 h-11 rounded-lg text-[13.5px] font-medium transition ${
                isActive ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 min-w-0">
          <span className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-200 text-[12px] font-bold flex items-center justify-center shrink-0">
            {(owner?.name || "SA").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold text-white truncate">{owner?.name || "Super admin"}</span>
            {owner?.email && <span className="block text-[11px] text-slate-400 truncate">{owner.email}</span>}
          </span>
        </div>
        <Link
          to="/app"
          className="w-full h-10 mb-2 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition"
        >
          View shop app
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-10 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-navy-900">
      {/* Top Prototype Switcher Bar */}
      <DemoBar onOpenGuide={() => setDemoGuideOpen(true)} />

      <div className="flex min-h-0 flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#04261D] flex-col shrink-0 sticky top-0 h-[100dvh]">{sidebar}</aside>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-[visibility] duration-300 ${open ? "visible" : "invisible"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[#04261D] flex flex-col shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>{sidebar}</aside>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="h-14 sm:h-16 border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-3 bg-white/95 backdrop-blur sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setOpen(true)} className="lg:hidden w-10 h-10 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center" aria-label="Open menu">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className="text-[14px] font-bold text-navy-900 truncate">{current?.label || "Platform"}</span>
          </div>
          <span className="shrink-0 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Super Admin Governance</span>
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 min-w-0 bg-white">
          <Outlet />
        </main>
        </div>
      </div>
      <AdminFooter />

      {/* Floating Hinglish Toggle Button */}
      <HinglishToggle />

      {/* Demo Guide Modal */}
      <DemoGuideModal
        isOpen={demoGuideOpen}
        onClose={() => setDemoGuideOpen(false)}
      />
    </div>
  );
}
