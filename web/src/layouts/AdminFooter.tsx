import { Link } from "react-router-dom";

export default function AdminFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-5 text-[11.5px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 font-black text-violet-700 ring-1 ring-inset ring-violet-100">N</span>
          <span><strong className="text-navy-900">NSYU Platform</strong> · Governance console</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/admin" className="transition hover:text-violet-700">Overview</Link>
          <Link to="/admin/shops" className="transition hover:text-violet-700">Shops</Link>
          <Link to="/admin/audit-logs" className="transition hover:text-violet-700">Audit logs</Link>
          <span className="inline-flex items-center gap-1.5 text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Systems operational</span>
        </div>
      </div>
    </footer>
  );
}
