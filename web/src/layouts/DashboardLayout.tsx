import { useState } from "react";
import { Outlet } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import BusinessFooter from "./BusinessFooter";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Universal Top Header with Brand, Navigation & Profile */}
      <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="flex min-h-0 flex-1 w-full max-w-[1800px] mx-auto">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto w-full page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Universal Bottom Footer */}
      <BusinessFooter />
    </div>
  );
}
