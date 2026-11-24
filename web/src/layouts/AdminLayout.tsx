import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import AdminFooter from "./AdminFooter";

export default function AdminLayout() {
  const { owner, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
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
      to: "/admin/categories",
      end: false,
      label: "Master Categories",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      to: "/admin/notifications",
      end: false,
      label: "Platform Notifications",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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
          <span className="w-10 h-10 rounded-xl bg-white p-1 shrink-0 shadow-lg shadow-black/20 ring-1 ring-white/20"><img src="/nsyu_logo.png" alt="" className="w-full h-full object-contain" /></span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold tracking-tight text-white">NSYU Platform</span>
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-300/90">Super admin</span>
          </span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="lg:hidden w-9 h-9 rounded-lg text-slate-300 hover:bg-white/10 flex items-center justify-center" aria-label="Close menu">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-2 text-[10.5px] font-bold tracking-[0.14em] text-brand-200/50 uppercase">Platform governance</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 h-11 rounded-xl text-[13.5px] font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-black/25 ring-1 ring-inset ring-white/15"
                  : "text-brand-50/70 hover:bg-white/[0.06] hover:text-white hover:translate-x-0.5"
              }`
            }
          >
            <span className="shrink-0 opacity-90 [&>svg]:w-[18px] [&>svg]:h-[18px]">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 min-w-0">
          <span className="w-9 h-9 rounded-full bg-brand-gradient ring-1 ring-white/20 text-white text-[12px] font-bold flex items-center justify-center shrink-0">
            {(owner?.name || "SA").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold text-white truncate">{owner?.name || "Super admin"}</span>
            {owner?.email && <span className="block text-[11px] text-slate-400 truncate">{owner.email}</span>}
          </span>
        </div>
        <Link
          to="/app"
          className="w-full h-10 mb-2 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-brand-50 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition"
        >
          View shop app
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-10 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-400/20 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col text-navy-900">
      <div className="flex min-h-0 flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[264px] bg-navy-950 bg-[radial-gradient(120%_60%_at_0%_0%,rgba(16,185,129,0.18),transparent_60%)] flex-col shrink-0 sticky top-0 h-[100dvh]">{sidebar}</aside>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-[visibility] duration-300 ${open ? "visible" : "invisible"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-navy-950/50 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-navy-950 flex flex-col shadow-2xl transition-transform duration-300 ease-smooth ${open ? "translate-x-0" : "-translate-x-full"}`}>{sidebar}</aside>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 sm:h-16 border-b border-border/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 bg-white/80 backdrop-blur-xl sticky top-0 z-30 shadow-[0_6px_20px_-16px_rgba(15,42,35,0.25)]">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setOpen(true)} className="lg:hidden w-10 h-10 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center" aria-label="Open menu">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className="min-w-0">
              <span className="block text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400 leading-none">Super admin</span>
              <span className="block mt-1 text-[15px] font-extrabold tracking-tight text-navy-900 truncate leading-none">{current?.label || "Platform"}</span>
            </span>
          </div>
          <span className="shrink-0 px-2.5 py-1 bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/15 rounded-full text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="hidden min-[420px]:inline">Super Admin Governance</span>
            <span className="min-[420px]:hidden">Admin</span>
          </span>
        </header>

        <main className="flex-1 px-3 py-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip">
          <div className="mx-auto w-full max-w-[1500px] page-enter">
            <Outlet />
          </div>
        </main>
        </div>
      </div>
      <AdminFooter />
    </div>
  );
}
