import { useState } from "react";
import { Outlet } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import BusinessFooter from "./BusinessFooter";
import MobileBottomNav from "../components/MobileBottomNav";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-canvas min-h-screen flex flex-col w-full max-w-full overflow-x-clip">
      {/* Universal Top Header with Brand, Navigation & Profile */}
      <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="flex min-h-0 flex-1 w-full max-w-[1800px] mx-auto overflow-x-clip">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 w-full max-w-full px-3 py-4 sm:px-6 sm:py-7 lg:px-8 xl:px-10 pb-28 md:pb-10 overflow-x-clip">
          <div className="mx-auto w-full max-w-[1560px] page-enter overflow-x-clip">
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
