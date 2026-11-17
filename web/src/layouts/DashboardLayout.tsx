import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar open={navOpen} onClose={closeNav} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 w-full max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
