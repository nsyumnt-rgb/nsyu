import { Outlet } from "react-router-dom";
import BusinessHeader from "./BusinessHeader";
import BusinessFooter from "./BusinessFooter";
import Sidebar from "./Sidebar";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Universal Top Header with Brand, Navigation & Profile */}
      <BusinessHeader />

      <div className="flex min-h-0 flex-1 w-full max-w-[1800px] mx-auto">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1500px] page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Universal Bottom Footer with Brand, Contact Info & Copyright */}
      <BusinessFooter />
    </div>
  );
}
