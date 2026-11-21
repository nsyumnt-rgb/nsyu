import { useState } from "react";
import { Outlet } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import BusinessFooter from "./BusinessFooter";
import MobileBottomNav from "../components/MobileBottomNav";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      {/* Universal Top Header with Brand, Navigation & Profile */}
      <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="flex min-h-0 flex-1 w-full max-w-[1800px] mx-auto">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 pb-24 md:pb-8">
          <div className="mx-auto w-full page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Universal Bottom Footer (Desktop only) */}
      <div className="hidden md:block">
        <BusinessFooter />
      </div>

      {/* Mobile-First App Navigation Bar */}
      <MobileBottomNav mode="dashboard" />
    </div>
  );
}
