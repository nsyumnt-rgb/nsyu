import { Outlet } from "react-router-dom";
import BusinessHeader from "./BusinessHeader";
import BusinessFooter from "./BusinessFooter";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Universal Top Header with Brand, Navigation & Profile */}
      <BusinessHeader />

      {/* Main Page Workspace */}
      <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 w-full max-w-[1700px] mx-auto">
        <Outlet />
      </main>

      {/* Universal Bottom Footer with Brand, Contact Info & Copyright */}
      <BusinessFooter />
    </div>
  );
}
