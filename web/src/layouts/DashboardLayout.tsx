import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BusinessHeader from "./BusinessHeader";
import BusinessFooter from "./BusinessFooter";
import Sidebar from "./Sidebar";
import DemoBar from "../components/DemoBar";
import HinglishToggle from "../components/HinglishToggle";
import DemoGuideModal from "../components/DemoGuideModal";

export default function DashboardLayout() {
  const location = useLocation();
  const [demoGuideOpen, setDemoGuideOpen] = useState(false);

  // Pages with dedicated full-website layout (Category Sidebar, Product Grid, Inventory Table, Staff Grid)
  const isFullWidthPage = [
    "/app/catalog",
    "/app/products",
    "/app/inventory",
    "/app/staff",
  ].some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Prototype Persona Switcher Bar */}
      <DemoBar onOpenGuide={() => setDemoGuideOpen(true)} />

      {/* Universal Top Header with Brand, Navigation & Profile */}
      <BusinessHeader />

      <div className="flex min-h-0 flex-1 w-full max-w-[1800px] mx-auto">
        {!isFullWidthPage && <Sidebar />}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto w-full page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Universal Bottom Footer with Brand, Contact Info & Copyright */}
      <BusinessFooter />

      {/* Floating Hinglish Toggle Button */}
      <HinglishToggle />

      {/* Demo Guide Modal */}
      <DemoGuideModal
        isOpen={demoGuideOpen}
        onClose={() => setDemoGuideOpen(false)}
      />
    </div>
  );
}
