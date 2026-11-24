import { Link } from "react-router-dom";

export default function AdminFooter() {
  return (
    <footer className="border-t border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-4 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient font-black text-white text-[12px] shadow-brand">N</span>
          <span>
            <strong className="text-navy-900">NSYU Platform</strong> · Governance console
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/admin" className="font-medium transition hover:text-brand-700">Overview</Link>
          <Link to="/admin/shops" className="font-medium transition hover:text-brand-700">Shops</Link>
          <Link to="/admin/audit-logs" className="font-medium transition hover:text-brand-700">Audit logs</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}
