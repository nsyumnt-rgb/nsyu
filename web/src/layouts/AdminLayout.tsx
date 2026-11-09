import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function AdminLayout() {
  const { owner, logout } = useAuthStore();
  const navigate = useNavigate();

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

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      {/* Super Admin Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg">
              SA
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide text-white">NSYU PLATFORM</h1>
              <span className="text-[10px] font-semibold tracking-wider text-purple-400 uppercase bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50">
                Super Admin
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Platform Governance
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom User Area */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">{owner?.name || "Super Admin"}</p>
              <p className="text-[11px] text-slate-400 truncate">{owner?.email || "superadmin@nsyu.com"}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Link
              to="/app"
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 rounded-md border border-slate-800 transition"
            >
              <span>View Shop App</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-950/30 hover:bg-red-900/40 rounded-md border border-red-900/40 transition"
            >
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-950/60 backdrop-blur shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Platform Online</span>
            <span className="text-slate-600">•</span>
            <span>PostgreSQL & RLS Enforced</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="px-2.5 py-1 bg-amber-950/50 text-amber-300 border border-amber-800/60 rounded-full font-medium">
              Read-Only for Shop Data
            </span>
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-full font-mono">
              v1.0.0-PROD
            </span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
